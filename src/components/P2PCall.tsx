/**
 * @file P2PCall.tsx
 * @description Appel audio/vidéo multijoueur en VRAI WebRTC (react-native-webrtc),
 *   100 % infrastructure SALISTAR :
 *     - ICE servers (STUN/TURN) = coturn turn.salistar.com via /api/turn-creds
 *       (credentials HMAC tournants). AUCUN service tiers (ni Jitsi, ni Google).
 *     - Signaling = socket-server namespace /webrtc (offer/answer/ice relay).
 *     - Topologie mesh : chaque participant ouvre une RTCPeerConnection vers
 *       chaque autre. Le dernier arrivé initie l'offre vers les présents.
 *
 * Nécessite un dev build (react-native-webrtc est natif — déjà en deps).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import { getSocketUrl, getTurnCredentials } from '../../shared/api';

// react-native-webrtc : import défensif (présent en dev build, pas en Expo Go).
let RTCPeerConnection: any, RTCIceCandidate: any, RTCSessionDescription: any,
  mediaDevices: any, RTCView: any;
let webrtcAvailable = false;
try {
  const w = require('react-native-webrtc');
  RTCPeerConnection = w.RTCPeerConnection;
  RTCIceCandidate = w.RTCIceCandidate;
  RTCSessionDescription = w.RTCSessionDescription;
  mediaDevices = w.mediaDevices;
  RTCView = w.RTCView;
  webrtcAvailable = !!RTCPeerConnection;
} catch { webrtcAvailable = false; }

const log = logger.scoped('P2PCall');

interface SimulatedPeer { userId: string; username: string; isHost?: boolean }
interface Props {
  roomCode: string;
  displayName: string;
  authToken: string;
  simulatedPeers?: SimulatedPeer[];
  onClose?: () => void;
  /** Mode compact : rangée de petites vignettes (moi + les autres) — pour
   *  l'intégrer dans le plateau de jeu sans masquer la table. */
  compact?: boolean;
}
interface Peer { userId: string; username: string; socketId: string }

async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return (
      res[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
      res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch { return true; }
}

export default function P2PCall({ roomCode, displayName, authToken, onClose, compact }: Props) {
  const [status, setStatus] = useState('Initialisation…');
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ socketId: string; username: string; url: string }[]>([]);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<any>(null);
  const pcsRef = useRef<Map<string, any>>(new Map());          // socketId → RTCPeerConnection
  const iceServersRef = useRef<any[]>([]);
  const peersMetaRef = useRef<Map<string, string>>(new Map()); // socketId → username

  // ── Crée une RTCPeerConnection vers un peer (avec TURN SALISTAR) ──
  const createPc = useCallback((socketId: string, username: string) => {
    if (pcsRef.current.has(socketId)) return pcsRef.current.get(socketId);
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peersMetaRef.current.set(socketId, username);

    // Ajoute les pistes locales
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((tr: any) => pc.addTrack(tr, local));

    pc.onicecandidate = (e: any) => {
      if (e.candidate) {
        socketRef.current?.emit('webrtc:ice', { roomCode, to: socketId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e: any) => {
      const stream = e.streams?.[0];
      if (stream) {
        setRemote((prev) => {
          const others = prev.filter((r) => r.socketId !== socketId);
          return [...others, { socketId, username: peersMetaRef.current.get(socketId) || username, url: stream.toURL() }];
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        setRemote((prev) => prev.filter((r) => r.socketId !== socketId));
      }
    };
    pcsRef.current.set(socketId, pc);
    return pc;
  }, [roomCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!webrtcAvailable) { setStatus('WebRTC indisponible (dev build requis)'); return; }
      const ok = await ensurePermissions();
      if (!ok) { setStatus('Permissions caméra/micro refusées'); return; }

      // 1) Stream local
      try {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
        if (cancelled) return;
        localStreamRef.current = stream;
        setLocalStreamUrl(stream.toURL());
      } catch (e: any) {
        setStatus('Caméra/micro inaccessibles: ' + (e?.message ?? ''));
        return;
      }

      // 2) ICE servers SALISTAR (TURN/STUN coturn, credentials HMAC)
      try {
        const creds = await getTurnCredentials();
        iceServersRef.current = creds.iceServers;
        const hasRelay = creds.iceServers.some((srv: any) => !!srv.credential);
        const urlCount = creds.iceServers.reduce((n: number, s: any) => n + (Array.isArray(s.urls) ? s.urls.length : 1), 0);
        log.explain(`ICE SALISTAR : ${urlCount} URL(s) · relay TURN ${hasRelay ? 'ACTIF ✅' : 'STUN seul (pas de relay)'}`);
      } catch {
        iceServersRef.current = [];
      }

      // 3) Signaling socket /webrtc
      setStatus('Connexion au signaling…');
      const sock = io(`${getSocketUrl()}/webrtc`, { auth: { token: authToken }, transports: ['websocket'] });
      socketRef.current = sock;

      sock.on('connect', () => { setStatus('Connecté'); sock.emit('webrtc:join', { roomCode }); });

      // Je suis le nouvel arrivant → j'initie une offre vers chaque présent
      sock.on('webrtc:peers', async (data: { peers: Peer[] }) => {
        setStatus(`Dans la room · ${data.peers.length + 1} participant(s)`);
        for (const peer of data.peers) {
          const pc = createPc(peer.socketId, peer.username);
          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);
          sock.emit('webrtc:offer', { roomCode, to: peer.socketId, sdp: offer });
        }
      });

      // Un peer arrive après moi → il initiera l'offre, je l'attends
      sock.on('webrtc:joined', (peer: Peer) => {
        peersMetaRef.current.set(peer.socketId, peer.username);
        setStatus(`🙋 ${peer.username} a rejoint`);
      });

      sock.on('webrtc:offer', async (data: { from: string; sdp: any; username?: string }) => {
        const pc = createPc(data.from, data.username || 'Joueur');
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock.emit('webrtc:answer', { roomCode, to: data.from, sdp: answer });
      });

      sock.on('webrtc:answer', async (data: { from: string; sdp: any }) => {
        const pc = pcsRef.current.get(data.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      sock.on('webrtc:ice', async (data: { from: string; candidate: any }) => {
        const pc = pcsRef.current.get(data.from);
        if (pc && data.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
        }
      });

      sock.on('webrtc:left', (data: { socketId: string }) => {
        const pc = pcsRef.current.get(data.socketId);
        if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(data.socketId); }
        setRemote((prev) => prev.filter((r) => r.socketId !== data.socketId));
      });

      sock.on('connect_error', (e: any) => setStatus('Erreur signaling: ' + e?.message));
    })();

    return () => {
      cancelled = true;
      pcsRef.current.forEach((pc) => { try { pc.close(); } catch {} });
      pcsRef.current.clear();
      localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
      socketRef.current?.emit('webrtc:leave', { roomCode });
      socketRef.current?.disconnect();
    };
  }, [roomCode, authToken, createPc]);

  const toggleMic = () => {
    const next = !micOn; setMicOn(next);
    localStreamRef.current?.getAudioTracks?.().forEach((t: any) => { t.enabled = next; });
  };
  const toggleCam = () => {
    const next = !camOn; setCamOn(next);
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => { t.enabled = next; });
  };

  if (!webrtcAvailable) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle" size={32} color="#EF4444" />
        <Text style={styles.errorText}>WebRTC nécessite un dev build (react-native-webrtc)</Text>
      </View>
    );
  }

  // ── Mode COMPACT : rangée horizontale de vignettes (moi + les autres) ──
  if (compact) {
    return (
      <View style={styles.compactRoot}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactRow}>
          {/* Ma vignette */}
          <View style={styles.compactTile}>
            {camOn && localStreamUrl && RTCView ? (
              <RTCView streamURL={localStreamUrl} style={StyleSheet.absoluteFill as any} objectFit="cover" mirror />
            ) : (
              <View style={styles.compactOff}>
                {!localStreamUrl ? <ActivityIndicator color="#C084FC" /> : <Ionicons name="videocam-off" size={22} color="#6B7280" />}
              </View>
            )}
            <View style={styles.compactLabel}>
              <Text style={styles.compactName} numberOfLines={1}>Moi</Text>
              {!micOn && <Ionicons name="mic-off" size={10} color="#fff" style={{ marginLeft: 3 }} />}
            </View>
          </View>
          {/* Vignettes des AUTRES participants (flux WebRTC distants) */}
          {remote.map((r) => (
            <View key={r.socketId} style={styles.compactTile}>
              {RTCView && <RTCView streamURL={r.url} style={StyleSheet.absoluteFill as any} objectFit="cover" />}
              <View style={styles.compactLabel}>
                <Text style={styles.compactName} numberOfLines={1}>{r.username}</Text>
              </View>
            </View>
          ))}
          {remote.length === 0 && (
            <View style={styles.compactWaiting}>
              <Text style={styles.compactWaitingText}>En attente{'\n'}des autres caméras…</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.compactBar}>
          <Text style={styles.compactStatus} numberOfLines={1}>{status}</Text>
          <TouchableOpacity onPress={toggleMic} style={[styles.compactCtrl, !micOn && styles.ctrlBtnOff]}>
            <Ionicons name={micOn ? 'mic' : 'mic-off'} size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleCam} style={[styles.compactCtrl, !camOn && styles.ctrlBtnOff]}>
            <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={16} color="#fff" />
          </TouchableOpacity>
          {!!onClose && (
            <TouchableOpacity onPress={onClose} style={styles.compactCtrl}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{status}</Text>
        {!!onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Ma vidéo locale */}
      <View style={styles.myTile}>
        {camOn && localStreamUrl && RTCView ? (
          <RTCView streamURL={localStreamUrl} style={styles.video} objectFit="cover" mirror />
        ) : (
          <View style={styles.cameraOff}>
            {!localStreamUrl ? <ActivityIndicator color="#C084FC" /> : <Ionicons name="videocam-off" size={40} color="#6B7280" />}
            <Text style={styles.cameraOffText}>{localStreamUrl ? 'Caméra coupée' : 'Caméra…'}</Text>
          </View>
        )}
        <View style={styles.myLabel}>
          <Text style={styles.myLabelText}>{displayName} (moi)</Text>
          {!micOn && <Ionicons name="mic-off" size={12} color="#fff" style={{ marginLeft: 4 }} />}
        </View>
      </View>

      {/* Vidéos distantes (vrais flux WebRTC) */}
      {remote.length > 0 && (
        <View style={styles.peersGrid}>
          {remote.map((r) => (
            <View key={r.socketId} style={styles.peerTile}>
              {RTCView && <RTCView streamURL={r.url} style={StyleSheet.absoluteFill as any} objectFit="cover" />}
              <View style={styles.peerLabel}>
                <Text style={styles.peerName} numberOfLines={1}>{r.username}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleMic} style={[styles.ctrlBtn, !micOn && styles.ctrlBtnOff]}>
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleCam} style={[styles.ctrlBtn, !camOn && styles.ctrlBtnOff]}>
          <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A1A' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderBottomWidth: 1, borderColor: 'rgba(124,58,237,0.5)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusText: { color: '#fff', fontSize: 11, fontFamily: 'Inter-SemiBold', flex: 1 },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 4 },
  myTile: {
    aspectRatio: 4 / 3, borderRadius: 8, overflow: 'hidden',
    marginHorizontal: 8, marginTop: 8, borderWidth: 2, borderColor: '#7C3AED',
  },
  video: { flex: 1, backgroundColor: '#000' },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E1B3A', gap: 6 },
  cameraOffText: { color: '#6B7280', fontSize: 12 },
  myLabel: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  myLabelText: { color: '#fff', fontSize: 10, fontFamily: 'Inter-Bold' },
  peersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 8, paddingTop: 6, gap: 6 },
  peerTile: {
    width: '31%', aspectRatio: 3 / 4, backgroundColor: '#1E1B3A', borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  peerLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 3 },
  peerName: { color: '#fff', fontSize: 9, fontFamily: 'Inter-Bold' },
  controls: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  ctrlBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(124,58,237,0.9)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnOff: { backgroundColor: 'rgba(239,68,68,0.9)' },
  error: {
    padding: 16, margin: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', alignItems: 'center', gap: 6,
  },
  errorText: { color: '#FCA5A5', fontSize: 11, textAlign: 'center' },

  // ── Mode compact (intégré au plateau de jeu) ──
  compactRoot: { backgroundColor: '#0A0A1A', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)' },
  compactRow: { padding: 8, gap: 8, alignItems: 'center' },
  compactTile: { width: 118, height: 150, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1E1B3A', borderWidth: 1, borderColor: '#7C3AED' },
  compactOff: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E1B3A' },
  compactLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 3 },
  compactName: { color: '#fff', fontSize: 10, fontFamily: 'Inter-Bold' },
  compactWaiting: { height: 150, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  compactWaitingText: { color: '#8B8B9E', fontSize: 12, textAlign: 'center' },
  compactBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: 'rgba(124,58,237,0.4)' },
  compactStatus: { flex: 1, color: '#fff', fontSize: 11, fontFamily: 'Inter-SemiBold' },
  compactCtrl: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(124,58,237,0.9)', alignItems: 'center', justifyContent: 'center' },
});
