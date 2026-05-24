/**
 * @file tournament/list.tsx
 * @description Liste des tournois (daily/weekly/monthly). Consomme
 *   /tournaments?gameType=belote. Tap → détail /tournament/[id].
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

interface Tournament {
  _id: string;
  name: string;
  scope: 'daily' | 'weekly' | 'monthly';
  status: 'upcoming' | 'open' | 'running' | 'finished';
  participantsCount: number;
  maxParticipants: number;
  startsAt: string;
  prizes?: { rank: number; reward: string }[];
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  upcoming: { color: '#6B7280', label: 'À venir' },
  open: { color: '#10B981', label: 'Inscriptions' },
  running: { color: '#F59E0B', label: 'En cours' },
  finished: { color: '#3B82F6', label: 'Terminé' },
};

export default function TournamentListScreen() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Tournament[]>('/tournaments?gameType=belote');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Tournois</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#FCD34D" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FCD34D" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="trophy-outline" size={42} color="#6B7280" />
              <Text style={{ color: '#6B7280', marginTop: 10 }}>Aucun tournoi pour le moment</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.upcoming;
            return (
              <TouchableOpacity style={s.card} onPress={() => router.push(`/tournament/${item._id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.meta}>{item.scope} · {item.participantsCount}/{item.maxParticipants} joueurs</Text>
                  {item.prizes?.[0] && (
                    <Text style={s.prize}>🏆 {item.prizes[0].reward}</Text>
                  )}
                </View>
                <View style={[s.statusPill, { backgroundColor: meta.color }]}>
                  <Text style={s.statusText}>{meta.label}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#152A47', borderRadius: 14, padding: 16, marginBottom: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  meta: { color: '#93C5FD', fontSize: 12, marginTop: 3 },
  prize: { color: '#FCD34D', fontSize: 12, fontWeight: '700', marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
