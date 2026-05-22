/**
 * @file challenge/history.tsx
 * @description Historique des challenges donnes / recus / executes.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../shared/api';

interface ChallengeRow {
  _id: string;
  type: 'walk' | 'run';
  distanceMeters: number;
  status: 'pending' | 'in-progress' | 'done' | 'failed' | 'expired';
  elapsedTimeMs?: number;
  createdAt: string;
  role: 'given' | 'received';
}

export default function HistoryScreen() {
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ChallengeRow[]>('/challenges/sport/history')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1, backgroundColor: '#0A1F44' }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, color: '#FCD34D', fontWeight: '900' }}>Historique</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r._id}
        renderItem={({ item }) => {
          const colors: Record<string, string> = {
            'done': '#10B981', 'failed': '#EF4444', 'expired': '#9CA3AF',
            'in-progress': '#FCD34D', 'pending': '#3B82F6',
          };
          return (
            <View style={{ marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: '#152A47', borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {item.type === 'walk' ? '🚶 Marche' : '🏃 Course'} · {item.distanceMeters} m
                </Text>
                <Text style={{ color: colors[item.status] || '#fff', fontWeight: '700' }}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: '#93C5FD', marginTop: 4 }}>
                {item.role === 'given' ? 'Donne par toi' : 'Recu'} · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              {item.elapsedTimeMs !== undefined && (
                <Text style={{ color: '#fff', marginTop: 4 }}>
                  Temps : {Math.floor(item.elapsedTimeMs / 60000)}m{Math.floor((item.elapsedTimeMs % 60000) / 1000)}s
                </Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: '#93C5FD', textAlign: 'center', padding: 40 }}>
            Aucun challenge pour le moment.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
