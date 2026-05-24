/**
 * @file challenge/active.tsx
 * @description Challenge en cours : timer + GPS tracking + carte.
 * Capture position toutes les 2s. Envoie batch toutes les 10s vers backend.
 * Auto-detect arrivee (distance < 30m de B).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as api from '../../shared/api';

interface GpsPoint { lat: number; lng: number; ts: number; accuracyM: number }

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function ActiveChallengeScreen() {
  const params = useLocalSearchParams<{ challengeId: string; pointB: string; deadlineAt: string }>();
  const pointB = params.pointB ? JSON.parse(params.pointB) : null;
  const deadline = params.deadlineAt ? new Date(params.deadlineAt).getTime() : Date.now() + 3600 * 1000;

  const [track, setTrack] = useState<GpsPoint[]>([]);
  const [remainingS, setRemainingS] = useState(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
  const [arrived, setArrived] = useState(false);
  const batchRef = useRef<GpsPoint[]>([]);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission GPS requise');
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (loc) => {
          const p: GpsPoint = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            ts: loc.timestamp,
            accuracyM: loc.coords.accuracy ?? 99,
          };
          setTrack((t) => [...t, p]);
          batchRef.current.push(p);
          if (pointB && distM(p, pointB) < 30) {
            setArrived(true);
          }
        },
      );
    })();

    // Batch upload toutes les 10 sec
    batchTimer.current = setInterval(() => {
      if (batchRef.current.length === 0) return;
      const batch = [...batchRef.current];
      batchRef.current = [];
      api.post(`/challenges/sport/${params.challengeId}/track`, { points: batch }).catch(() => {});
    }, 10000);

    // Decompte
    tickTimer.current = setInterval(() => {
      const rs = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemainingS(rs);
      if (rs === 0 && !arrived) {
        // Echec
        api.post(`/challenges/sport/${params.challengeId}/finish`, { success: false }).catch(() => {});
        Alert.alert('Temps ecoule', 'Tu n\'as pas atteint le point B a temps.');
        router.replace('/challenge/history');
      }
    }, 1000);

    return () => {
      subscription?.remove();
      if (batchTimer.current) clearInterval(batchTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, []);

  useEffect(() => {
    if (arrived) {
      api.post(`/challenges/sport/${params.challengeId}/finish`, { success: true, durationMs: Date.now() - track[0]?.ts })
        .then(() => router.replace('/challenge/share'))
        .catch(() => router.replace('/challenge/history'));
    }
  }, [arrived]);

  const mm = String(Math.floor(remainingS / 60)).padStart(2, '0');
  const ss = String(remainingS % 60).padStart(2, '0');
  const lastP = track[track.length - 1];
  const distRemaining = lastP && pointB ? Math.round(distM(lastP, pointB)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <View style={{ padding: 24 }}>
        <Text style={{ fontSize: 14, color: '#93C5FD' }}>Temps restant</Text>
        <Text style={{ fontSize: 64, color: '#FCD34D', fontWeight: '900' }}>{mm}:{ss}</Text>
        <View style={{ marginTop: 24, padding: 16, backgroundColor: '#152A47', borderRadius: 12 }}>
          <Text style={{ color: '#93C5FD' }}>Distance restante</Text>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900' }}>{distRemaining} m</Text>
          <Text style={{ color: '#93C5FD', marginTop: 8 }}>Points GPS captures : {track.length}</Text>
        </View>
        <View style={{ marginTop: 24, padding: 16, backgroundColor: '#0d4f3c', borderRadius: 12 }}>
          <Text style={{ color: '#34d399', fontWeight: '700' }}>Astuce</Text>
          <Text style={{ color: '#fff', marginTop: 4 }}>
            Reste en mouvement et garde le telephone allume. L'app suit ta position toutes les 2 secondes.
          </Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Abandonner ?', 'Tu perdras le challenge.', [
            { text: 'Non' },
            { text: 'Abandonner', style: 'destructive', onPress: () => {
              api.post(`/challenges/sport/${params.challengeId}/finish`, { success: false }).catch(() => {});
              router.replace('/challenge/history');
            }}])}
          style={{ marginTop: 32, padding: 14, backgroundColor: '#EF4444', borderRadius: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Abandonner</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
