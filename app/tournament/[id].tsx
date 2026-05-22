/**
 * @file tournament/[id].tsx
 * @description Détail d'un tournoi : infos, prix, classement live, bouton
 *   s'inscrire. GET /tournaments/:id + POST /tournaments/:id/join.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

interface Standing { rank: number; username: string; points: number; userId: string }
interface Tournament {
  _id: string;
  name: string;
  scope: string;
  status: 'upcoming' | 'open' | 'running' | 'finished';
  participantsCount: number;
  maxParticipants: number;
  startsAt: string;
  joined?: boolean;
  prizes?: { rank: number; reward: string }[];
  standings?: Standing[];
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>(`/tournaments/${id}`);
      // L'endpoint détail (partagé) renvoie {success, data} → double-wrap après
      // l'intercepteur global ; on déballe si besoin.
      const raw = res?.data ?? res;
      // Le backend renvoie la forme {code, type, entries, prizes[].gold, ranking}.
      // On mappe vers la forme attendue par cet écran.
      const mapped: Tournament = {
        _id: raw.code ?? id,
        name: raw.name ?? `Tournoi ${raw.type ?? ''}`.trim(),
        scope: raw.scope ?? raw.type ?? '',
        status: raw.status === 'closed' ? 'finished' : (raw.status ?? 'open'),
        participantsCount: raw.entries?.length ?? raw.participantsCount ?? 0,
        maxParticipants: raw.maxParticipants ?? 100,
        startsAt: raw.startsAt ? String(raw.startsAt) : '',
        joined: false,
        prizes: (raw.prizes ?? []).map((p: any) => ({ rank: p.rank, reward: p.reward ?? `${p.gold ?? 0} gold` })),
        standings: (raw.ranking ?? raw.standings ?? []).map((e: any, i: number) => ({
          rank: i + 1,
          username: e.username ?? e.displayName ?? '?',
          points: e.points ?? e.bestScore ?? 0,
          userId: e.userId ?? String(i),
        })),
      };
      setT(mapped);
    } catch {
      setT(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function join() {
    setJoining(true);
    try {
      await api.post(`/tournaments/${id}/join`, {});
      Alert.alert('Inscrit !', 'Tu participes à ce tournoi.');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Inscription impossible');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
        <ActivityIndicator color="#FCD34D" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!t) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color="#6B7280" />
        <Text style={{ color: '#93C5FD', marginTop: 12 }}>Tournoi introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.cta}>
          <Text style={s.ctaText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const canJoin = (t.status === 'open' || t.status === 'upcoming') && !t.joined && t.participantsCount < t.maxParticipants;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{t.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={s.infoCard}>
          <Text style={s.infoLine}>Format : <Text style={s.infoVal}>{t.scope}</Text></Text>
          <Text style={s.infoLine}>Joueurs : <Text style={s.infoVal}>{t.participantsCount}/{t.maxParticipants}</Text></Text>
          <Text style={s.infoLine}>Statut : <Text style={s.infoVal}>{t.status}</Text></Text>
        </View>

        {t.prizes && t.prizes.length > 0 && (
          <>
            <Text style={s.section}>🏆 Récompenses</Text>
            {t.prizes.map((p) => (
              <View key={p.rank} style={s.prizeRow}>
                <Text style={s.prizeRank}>#{p.rank}</Text>
                <Text style={s.prizeReward}>{p.reward}</Text>
              </View>
            ))}
          </>
        )}

        {t.standings && t.standings.length > 0 && (
          <>
            <Text style={s.section}>Classement</Text>
            {t.standings.map((st) => (
              <View key={st.userId} style={s.standRow}>
                <Text style={[s.standRank, st.rank <= 3 && { color: '#FCD34D' }]}>#{st.rank}</Text>
                <Text style={s.standName} numberOfLines={1}>{st.username}</Text>
                <Text style={s.standPts}>{st.points} pts</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {canJoin && (
        <TouchableOpacity style={s.joinBtn} onPress={join} disabled={joining}>
          {joining ? <ActivityIndicator color="#0A1F44" /> : <Text style={s.joinText}>S'inscrire</Text>}
        </TouchableOpacity>
      )}
      {t.joined && (
        <View style={[s.joinBtn, { backgroundColor: '#10B981' }]}>
          <Text style={[s.joinText, { color: '#fff' }]}>✓ Inscrit</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 },
  infoCard: { backgroundColor: '#152A47', borderRadius: 14, padding: 16, gap: 6 },
  infoLine: { color: '#93C5FD', fontSize: 13 },
  infoVal: { color: '#fff', fontWeight: '800' },
  section: { color: '#FCD34D', fontSize: 14, fontWeight: '900', marginTop: 20, marginBottom: 8 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#152A47', borderRadius: 10, padding: 12, marginBottom: 6 },
  prizeRank: { color: '#FCD34D', fontSize: 14, fontWeight: '900', width: 44 },
  prizeReward: { color: '#fff', fontSize: 13, flex: 1 },
  standRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#152A47', borderRadius: 10, padding: 12, marginBottom: 4 },
  standRank: { color: '#fff', fontSize: 14, fontWeight: '900', width: 44 },
  standName: { color: '#fff', fontSize: 13, flex: 1 },
  standPts: { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
  joinBtn: { backgroundColor: '#FCD34D', margin: 16, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  joinText: { color: '#0A1F44', fontSize: 16, fontWeight: '900' },
  cta: { backgroundColor: '#FCD34D', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  ctaText: { color: '#0A1F44', fontWeight: '900' },
});
