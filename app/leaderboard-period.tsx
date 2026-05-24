/**
 * @file leaderboard-period.tsx
 * @description Classements multi-période : jour / semaine / mois / week-end /
 *   saison. Consomme /rankings-period?gameType=belote&period=<p>.
 *   Le #1 global (tous classements) gagne un bon d'achat 100 EUR.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../shared/api';

type Period = 'daily' | 'weekly' | 'monthly' | 'weekend' | 'season';

const PERIODS: { id: Period; label: string; reward: string }[] = [
  { id: 'daily', label: 'Jour', reward: '+50 coins' },
  { id: 'weekly', label: 'Semaine', reward: '+200 coins' },
  { id: 'monthly', label: 'Mois', reward: '+1000 coins' },
  { id: 'weekend', label: 'Week-end', reward: '+500 coins' },
  { id: 'season', label: 'Saison', reward: 'Bon 100€' },
];

interface Row { rank: number; username: string; elo: number; userId: string }

export default function LeaderboardPeriodScreen() {
  const [period, setPeriod] = useState<Period>('daily');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const data = await api.get<Row[]>(`/rankings/belote?period=${p}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const current = PERIODS.find((p) => p.id === period)!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Classements</Text>
      </View>

      {/* Onglets période */}
      <View style={s.tabs}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setPeriod(p.id)}
            style={[s.tab, period === p.id && s.tabActive]}
          >
            <Text style={[s.tabText, period === p.id && s.tabTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bandeau récompense */}
      <View style={s.rewardBar}>
        <Ionicons name="gift" size={16} color="#FCD34D" />
        <Text style={s.rewardText}>Récompense {current.label.toLowerCase()} : {current.reward}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#FCD34D" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => `${it.userId}-${it.rank}`}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="trophy-outline" size={42} color="#6B7280" />
              <Text style={{ color: '#6B7280', marginTop: 10 }}>Aucun classement pour cette période</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <Text style={[s.rank, item.rank <= 3 && { color: '#FCD34D' }]}>#{item.rank}</Text>
              <Text style={s.name} numberOfLines={1}>{item.username}</Text>
              <Text style={s.elo}>{item.elo} ELO</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#152A47' },
  tabActive: { backgroundColor: '#FCD34D' },
  tabText: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#0A1F44' },
  rewardBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, padding: 10, backgroundColor: 'rgba(252,211,77,0.12)', borderRadius: 10 },
  rewardText: { color: '#FCD34D', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#152A47', borderRadius: 12, marginBottom: 6 },
  rank: { color: '#fff', fontSize: 16, fontWeight: '900', width: 48 },
  name: { color: '#fff', fontSize: 14, flex: 1 },
  elo: { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
});
