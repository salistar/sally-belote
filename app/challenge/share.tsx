/**
 * @file challenge/share.tsx
 * @description Écran de partage social après l'exécution d'un challenge sport.
 *   Affiche le temps réalisé + boutons de partage (Instagram/WhatsApp/TikTok/
 *   Snapchat) via l'API Share native (pas de dépendance externe).
 *
 * Reçoit en params optionnels : durationMs, distanceM, type ('walk'|'run').
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Share, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

function fmtDuration(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function ChallengeShareScreen() {
  const params = useLocalSearchParams<{ durationMs?: string; distanceM?: string; type?: string }>();
  const durationMs = Number(params.durationMs ?? 0);
  const distanceM = Number(params.distanceM ?? 0);
  const type = params.type === 'run' ? 'course' : 'marche';

  const message = useMemo(() => {
    const dur = durationMs > 0 ? fmtDuration(durationMs) : '';
    const dist = distanceM > 0 ? `${(distanceM / 1000).toFixed(2)} km` : '';
    const parts = [`J'ai relevé mon défi sport SallyCards 🏆`];
    if (type) parts.push(`(${type})`);
    if (dist) parts.push(`sur ${dist}`);
    if (dur) parts.push(`en ${dur}`);
    parts.push('— à toi de jouer ! 🎴 salistar.com');
    return parts.join(' ');
  }, [durationMs, distanceM, type]);

  async function doShare() {
    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Partage annulé');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.container}>
        <View style={s.badge}>
          <Ionicons name="trophy" size={56} color="#FCD34D" />
        </View>
        <Text style={s.title}>Challenge terminé !</Text>
        {durationMs > 0 && <Text style={s.time}>{fmtDuration(durationMs)}</Text>}
        {distanceM > 0 && (
          <Text style={s.sub}>{(distanceM / 1000).toFixed(2)} km · {type}</Text>
        )}

        <Text style={s.shareLabel}>Partage ta performance</Text>
        <View style={s.socialRow}>
          <SocialBtn icon="logo-whatsapp" color="#25D366" label="WhatsApp" onPress={doShare} />
          <SocialBtn icon="logo-instagram" color="#E1306C" label="Instagram" onPress={doShare} />
          <SocialBtn icon="logo-tiktok" color="#000" label="TikTok" onPress={doShare} />
        </View>

        <TouchableOpacity style={s.shareAllBtn} onPress={doShare}>
          <Ionicons name="share-social" size={18} color="#0A1F44" />
          <Text style={s.shareAllText}>Partager…</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={() => router.replace('/challenge/history')}>
          <Text style={s.skipText}>Passer → Historique</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SocialBtn({ icon, color, label, onPress }: { icon: any; color: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.socialBtn} onPress={onPress}>
      <View style={[s.socialIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={s.socialLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(252,211,77,0.15)',
    borderWidth: 3, borderColor: '#FCD34D',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 20 },
  time: { color: '#FCD34D', fontSize: 40, fontWeight: '900', marginTop: 8, letterSpacing: 2 },
  sub: { color: '#93C5FD', fontSize: 14, marginTop: 4 },
  shareLabel: { color: '#93C5FD', fontSize: 13, marginTop: 36, marginBottom: 14 },
  socialRow: { flexDirection: 'row', gap: 20 },
  socialBtn: { alignItems: 'center', gap: 6 },
  socialIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { color: '#fff', fontSize: 11 },
  shareAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCD34D', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, marginTop: 30,
  },
  shareAllText: { color: '#0A1F44', fontSize: 15, fontWeight: '900' },
  skipBtn: { marginTop: 16, padding: 10 },
  skipText: { color: '#93C5FD', fontSize: 13 },
});
