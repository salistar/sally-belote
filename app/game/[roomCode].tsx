/**
 * @file game/[roomCode].tsx
 * @description Table Belote multijoueur TEMPS RÉEL — client MINCE du gateway
 *   /game AUTORITATIF (le serveur fait foi). On se connecte au namespace /game,
 *   on émet `game:join {roomCode, gameType:'belote'}`, on rend la vue
 *   personnalisée reçue via `game:state` (ma main visible, celles des autres
 *   masquées), et on émet `game:action {roomCode, action}`.
 *
 *   ⇒ INTEROP WEB ↔ MOBILE : un joueur connecté sur le web et un joueur sur
 *   mobile partagent EXACTEMENT la même room (`belote:CODE`) sur l'unique
 *   instance socket-server. Mêmes events, même forme d'état, mêmes cartes
 *   espagnoles. Ce fichier est l'exact pendant RN de
 *   apps/web/app/belote/room/[code]/page.tsx.
 *
 *   Les bots qui complètent les sièges vides + toutes les transitions
 *   (distribution, plis, manches) sont gérés CÔTÉ SERVEUR.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { io, Socket } from 'socket.io-client';
import AppHeader from '../../src/components/AppHeader';
import AnimatedCard from '../../src/components/AnimatedCard';
import P2PCall from '../../src/components/P2PCall';
import Chat from '../../src/components/Chat';
import { useTheme } from '../../src/contexts/AppProviders';
import { logger } from '../../src/utils/logger';
import { APP_CONFIG } from '../../src/config/app.config';
import { getSocketUrl } from '../../shared/api';
import * as api from '../../shared/api';
import { getPlayableCards, SUITS, SUIT_NAMES, type Suit, type Card } from '../../src/game/beloteEngine';

const log = logger.scoped('BeloteRoom');

const GOLD = '#FCD34D';
const SUIT_SYMBOL: Record<Suit, string> = { bastos: '🌳', copas: '🍷', espadas: '⚔️', oros: '🪙' };

// ── Forme d'état reçue du serveur (viewFor) — identique au client web ────────
type HiddenCard = { hidden: true; id: string };
interface SeatPlayer { id: string; name: string; isBot: boolean; team: number; hand: (Card | HiddenCard)[] }
interface Snapshot {
  youId: string;
  phase: 'waiting' | 'bidding' | 'playing' | 'trick_end' | 'round_end' | 'game_over';
  players: SeatPlayer[];
  currentPlayerIndex: number;
  trumpSuit: Suit | null;
  currentTrick: { playerId: string; card: Card }[];
  teamScores: [number, number];
  roundNumber: number;
  winnerId: string | null;
  lastTrickWinner: string | null;
  bids: { playerId: string; suit: Suit | null }[];
}

/**
 * Résout un token valide pour le handshake socket : token courant, sinon
 * session invité (le web fait pareil via socketAuth). Garantit que le
 * middleware d'auth WS (sub + username requis) ne rejette pas la connexion.
 */
async function ensureToken(): Promise<string | null> {
  if (api.getAuthToken()) return api.getAuthToken();
  try { await api.createGuestSession(); } catch (e) { log.warn('guest session failed', (e as any)?.message); }
  return api.getAuthToken();
}

/** Sur erreur de token : refresh → invité (repli), comme forceRefreshGameToken web. */
async function refreshAuth(): Promise<string | null> {
  try { await api.refreshTokenAsync(); }
  catch { try { await api.createGuestSession(); } catch {} }
  return api.getAuthToken();
}

export default function BeloteRoomScreen() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const code = (roomCode || '').toString().toUpperCase();
  const router = useRouter();
  const { palette } = useTheme();

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string | null>(api.getAuthToken());

  // ── Connexion au gateway /game autoritatif ────────────────────────────────
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      await ensureToken();
      if (cancelled) return;
      tokenRef.current = api.getAuthToken();
      // auth en FONCTION : à chaque (re)connexion socket.io relit tokenRef →
      // un token rafraîchi est pris en compte sans recréer le socket.
      const s = io(`${getSocketUrl()}/game`, {
        transports: ['websocket'],
        timeout: 8000,
        auth: (cb: (d: any) => void) => cb({ token: tokenRef.current }),
      });
      socketRef.current = s;

      s.on('connect', () => {
        setConnected(true);
        log.explain(`socket /game connecté → game:join belote:${code}`);
        s.emit('game:join', { roomCode: code, gameType: 'belote' });
      });
      s.on('disconnect', () => setConnected(false));
      s.on('game:state', (snapshot: Snapshot) => setSnap(snapshot));
      s.on('game:error', (e: any) => log.warn('game:error', e?.message));
      s.on('connect_error', async (e: any) => {
        log.warn('connect_error', e?.message);
        if (/token|auth|jwt|unauthor/i.test(e?.message || '')) {
          await refreshAuth();
          tokenRef.current = api.getAuthToken();
          // socket.io retentera tout seul (function-auth relira le token).
        }
      });
    })();
    return () => { cancelled = true; socketRef.current?.disconnect(); socketRef.current = null; };
  }, [code]);

  // ── Dérivés (sièges relatifs : moi en bas, partenaire en haut) ────────────
  const me = snap?.players.find((p) => p.id === snap.youId) || null;
  const mySeat = snap && me ? snap.players.indexOf(me) : -1;
  const current = snap ? snap.players[snap.currentPlayerIndex] : null;
  const isMyTurn = !!(snap && me && current?.id === me.id);
  const myTeam = me?.team ?? 0;

  const myHand = (me?.hand || []).filter((c): c is Card => !(c as HiddenCard).hidden);
  const leadSuit = snap && snap.currentTrick.length > 0 ? snap.currentTrick[0].card.suit : null;
  const playable = useMemo(
    () => (isMyTurn && snap?.phase === 'playing'
      ? getPlayableCards(myHand, leadSuit, snap?.trumpSuit ?? null, snap?.currentTrick ?? [])
      : []),
    [isMyTurn, snap?.phase, myHand, leadSuit, snap?.trumpSuit],
  );
  const playableIds = useMemo(() => new Set(playable.map((c) => c.id)), [playable]);

  const seatAt = (offset: number): SeatPlayer | null =>
    (snap && mySeat >= 0 ? snap.players[(mySeat + offset) % 4] : null);
  const partner = seatAt(2);
  const right = seatAt(1);
  const left = seatAt(3);

  // ── Émetteurs d'actions (le serveur injecte le playerId depuis l'auth) ────
  const emitAction = useCallback((action: any) => {
    socketRef.current?.emit('game:action', { roomCode: code, action });
  }, [code]);

  const playCard = useCallback((cardId: string) => {
    if (!(isMyTurn && snap?.phase === 'playing' && playableIds.has(cardId))) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    emitAction({ type: 'PLAY_CARD', cardId });
  }, [isMyTurn, snap?.phase, playableIds, emitAction]);

  const bid = useCallback((suit: Suit | null) => {
    if (!(isMyTurn && snap?.phase === 'bidding')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    emitAction({ type: 'BID', suit });
  }, [isMyTurn, snap?.phase, emitAction]);

  const rematch = useCallback(() => {
    socketRef.current?.emit('game:start', { roomCode: code });
  }, [code]);

  useEffect(() => {
    if (snap?.phase === 'game_over') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [snap?.phase]);

  const styles = createStyles(palette);
  const isOver = snap?.phase === 'game_over';
  const iWin = isOver && snap?.winnerId === `team-${myTeam}`;

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGradient} style={StyleSheet.absoluteFill} />
      <AppHeader
        title={APP_CONFIG.name}
        subtitle={`Salon ${code || '—'} ${connected ? '· 🟢' : '· 🔌'}`}
        showBack
        onBack={() => setShowQuit(true)}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Comms : appel audio/vidéo + chat INDÉPENDANTS (les deux en même temps
            possible) — parité avec le plateau web. */}
        <View style={styles.commsRow}>
          <TouchableOpacity onPress={() => setVoiceOpen((v) => !v)} style={[styles.commsBtn, voiceOpen && styles.commsBtnActive]}>
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text style={styles.commsBtnText}>Appel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setChatOpen((v) => !v)} style={[styles.commsBtn, chatOpen && styles.commsBtnActive]}>
            <Ionicons name="chatbubbles" size={16} color="#fff" />
            <Text style={styles.commsBtnText}>Chat</Text>
          </TouchableOpacity>
        </View>
        {voiceOpen && (
          <View style={{ marginBottom: 12 }}>
            {/* compact = MA vignette + celles des AUTRES participants (mesh WebRTC),
                sur une rangée — n'écrase pas la table. */}
            <P2PCall compact roomCode={code} displayName={me?.name ?? 'Joueur'} authToken={api.getAuthToken() ?? ''} onClose={() => setVoiceOpen(false)} />
          </View>
        )}
        {chatOpen && (
          <View style={{ marginBottom: 12 }}>
            <Chat roomId={`belote-${code}`} token={api.getAuthToken()} onClose={() => setChatOpen(false)} />
          </View>
        )}

        {/* Scoreboard + atout */}
        <View style={styles.scoreRow}>
          <ScorePill label="Votre équipe" value={snap?.teamScores[myTeam] ?? 0} accent={iWin} palette={palette} />
          <ScorePill label="Adversaires" value={snap?.teamScores[(myTeam + 1) % 2] ?? 0} accent={isOver && !iWin} palette={palette} />
          <View style={styles.trumpBox}>
            {snap?.trumpSuit ? (
              <Text style={[styles.trumpText, { color: palette.textSecondary }]}>
                Atout{'\n'}<Text style={{ color: GOLD, fontFamily: 'Inter-Black' }}>{SUIT_SYMBOL[snap.trumpSuit]} {SUIT_NAMES[snap.trumpSuit]}</Text>
              </Text>
            ) : (
              <Text style={[styles.trumpText, { color: palette.textSecondary }]}>Manche {snap?.roundNumber ?? '—'}</Text>
            )}
          </View>
        </View>

        {/* Table feutrée : adversaires autour, pli au centre */}
        <View style={styles.table}>
          {!snap && (
            <View style={styles.tableEmpty}>
              <Text style={styles.tableEmptyText}>{connected ? 'Distribution…' : 'Connexion à la room…'}</Text>
            </View>
          )}
          {snap && (
            <>
              <Seat player={partner} pos="top" active={current?.id === partner?.id} palette={palette} />
              <Seat player={left} pos="left" active={current?.id === left?.id} palette={palette} />
              <Seat player={right} pos="right" active={current?.id === right?.id} palette={palette} />

              <View style={styles.trickCenter}>
                {snap.currentTrick.length === 0 && snap.phase !== 'bidding' && (
                  <Text style={styles.waitText}>En attente…</Text>
                )}
                <View style={styles.trickRow}>
                  {snap.currentTrick.map((e) => (
                    <AnimatedCard
                      key={e.card.id}
                      value={e.card.value}
                      suit={e.card.suit}
                      width={50}
                      height={75}
                      facing="up"
                      selected={e.playerId === snap.lastTrickWinner && snap.phase === 'trick_end'}
                    />
                  ))}
                </View>
              </View>

              {snap.phase === 'bidding' && (
                <View style={styles.bidBanner}>
                  <Text style={styles.bidBannerText}>Enchères — {current?.name}{isMyTurn ? ' · à vous' : '…'}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Ma main */}
        {snap && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.handTitle, { color: palette.text }]}>
              Votre main {isMyTurn && snap.phase === 'playing' ? '· à vous de jouer' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
              {myHand.map((c) => {
                const canPlay = playableIds.has(c.id);
                const dimmed = snap.phase === 'playing' && isMyTurn && !canPlay;
                const interactive = isMyTurn && snap.phase === 'playing' && canPlay;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => playCard(c.id)}
                    disabled={!interactive}
                    style={({ pressed }) => [
                      styles.handSlot,
                      interactive && styles.handSlotPlayable,
                      { opacity: dimmed ? 0.45 : 1, transform: [{ translateY: interactive && pressed ? -2 : interactive ? -8 : 0 }] },
                    ]}
                  >
                    <AnimatedCard value={c.value} suit={c.suit} width={62} height={92} facing="up" />
                  </Pressable>
                );
              })}
              {myHand.length === 0 && <Text style={{ color: palette.textSecondary, padding: 12 }}>Plus de cartes en main.</Text>}
            </ScrollView>

            {/* Enchères */}
            {snap.phase === 'bidding' && isMyTurn && (
              <View style={styles.bidRow}>
                {SUITS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => bid(s)} style={styles.bidBtn}>
                    <Text style={styles.bidBtnText}>{SUIT_SYMBOL[s]} {SUIT_NAMES[s]}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => bid(null)} style={[styles.bidBtn, styles.passBtn]}>
                  <Text style={[styles.bidBtnText, { color: '#fff' }]}>Passer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fin de partie */}
      <Modal visible={isOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['#0A0A1A', palette.card]} style={[styles.modalCard, { borderColor: GOLD }]}>
            <Text style={styles.modalEmoji}>{iWin ? '🏆' : '🤝'}</Text>
            <Text style={styles.modalTitle}>{iWin ? 'Votre équipe gagne !' : 'L’équipe adverse gagne'}</Text>
            <Text style={[styles.modalSub, { color: palette.textSecondary }]}>
              Score {snap?.teamScores[myTeam] ?? 0} – {snap?.teamScores[(myTeam + 1) % 2] ?? 0}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity onPress={rematch} style={[styles.modalBtn, { backgroundColor: APP_CONFIG.primary }]}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.modalBtnText}>Revanche</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.modalBtnText}>Quitter</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Quitter */}
      <Modal visible={showQuit} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.modalTitle}>Quitter la partie ?</Text>
            <Text style={[styles.modalSub, { color: palette.textSecondary }]}>Vous pourrez la rejoindre avec le même code.</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setShowQuit(false)} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowQuit(false); router.back(); }} style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.modalBtnText}>Quitter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sous-composants présentation ────────────────────────────────────────────
function ScorePill({ label, value, accent, palette }: { label: string; value: number; accent?: boolean; palette: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: accent ? 'rgba(252,211,77,0.18)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: accent ? GOLD : palette.border, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: palette.textSecondary, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter-Bold', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: accent ? GOLD : '#fff', fontFamily: 'Inter-Black', fontSize: 22 }}>{value}</Text>
    </View>
  );
}

function Seat({ player, pos, active, palette }: { player: SeatPlayer | null; pos: 'top' | 'left' | 'right'; active: boolean; palette: any }) {
  if (!player) return null;
  const wrap: any =
    pos === 'top' ? { top: 8, left: 0, right: 0, alignItems: 'center' }
    : pos === 'left' ? { left: 8, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-start' }
    : { right: 8, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-end' };
  return (
    <View style={{ position: 'absolute', ...wrap }}>
      <View style={{ flexDirection: 'row', marginBottom: 5, justifyContent: 'center' }}>
        {player.hand.slice(0, 5).map((_, i) => (
          <AnimatedCard key={i} facing="down" width={18} height={27} style={{ marginLeft: i ? -10 : 0 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: active ? 'rgba(252,211,77,0.22)' : 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: active ? GOLD : 'transparent', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontFamily: 'Inter-Bold', fontSize: 11 }}>{player.isBot ? '🤖 ' : ''}{player.name}</Text>
        <Text style={{ color: palette.textSecondary, fontSize: 10 }}>· {player.hand.length}</Text>
      </View>
    </View>
  );
}

function createStyles(palette: ReturnType<typeof useTheme>['palette']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    body: { padding: 14, paddingBottom: 40 },
    commsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    commsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: APP_CONFIG.primary },
    commsBtnActive: { backgroundColor: '#7C3AED' },
    commsBtnText: { color: '#fff', fontFamily: 'Inter-Bold', fontSize: 14 },
    commsPanel: { height: 470, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
    scoreRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'stretch' },
    trumpBox: { flex: 1, justifyContent: 'center', alignItems: 'flex-end' },
    trumpText: { fontSize: 12, fontFamily: 'Inter-SemiBold', textAlign: 'right' },
    table: {
      position: 'relative', minHeight: 320, borderRadius: 24,
      borderWidth: 5, borderColor: '#5b3a1a',
      backgroundColor: '#0E5A36', padding: 14, overflow: 'hidden',
    },
    tableEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    tableEmptyText: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter-Bold' },
    trickCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    trickRow: { flexDirection: 'row', gap: 6 },
    waitText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 },
    bidBanner: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
    bidBannerText: { backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', fontFamily: 'Inter-Bold', fontSize: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
    handTitle: { fontSize: 14, fontFamily: 'Inter-Bold', marginBottom: 8 },
    handScroll: { paddingVertical: 12, paddingHorizontal: 4, gap: 8, minHeight: 110 },
    handSlot: { marginHorizontal: 4, borderRadius: 8 },
    handSlotPlayable: { shadowColor: GOLD, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
    bidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
    bidBtn: { backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.4)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    bidBtnText: { color: GOLD, fontFamily: 'Inter-Black', fontSize: 13 },
    passBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
    modalCard: { padding: 26, borderRadius: 20, alignItems: 'center', borderWidth: 2, minWidth: 290, maxWidth: '85%' },
    modalEmoji: { fontSize: 52, marginBottom: 6 },
    modalTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter-Black', letterSpacing: 0.3, textAlign: 'center' },
    modalSub: { fontSize: 13, fontFamily: 'Inter-SemiBold', marginTop: 6 },
    modalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    modalBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter-Bold' },
  });
}
