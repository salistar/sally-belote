/**
 * @file notifications/inbox.tsx
 * @description Boite de notifications persistees (challenge recu, gagnant
 * notifie, tournoi qui demarre, achievement debloque, ...).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as api from '../../shared/api';

interface Notif {
  _id: string;
  type: 'challenge_received' | 'challenge_completed' | 'tournament_start' | 'achievement_unlocked' | 'friend_request' | 'reward_issued';
  title: string;
  body: string;
  payload?: any;
  readAt?: string;
  sentAt: string;
}

const ICONS: Record<Notif['type'], string> = {
  challenge_received: '🏃',
  challenge_completed: '🏁',
  tournament_start: '🏆',
  achievement_unlocked: '🎖️',
  friend_request: '👥',
  reward_issued: '🎁',
};

export default function InboxScreen() {
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => { reload(); }, []);
  function reload() {
    api.get<Notif[]>('/notifications').then(setItems).catch(() => {});
  }

  async function onTap(n: Notif) {
    if (!n.readAt) {
      await api.patch(`/notifications/${n._id}`, { read: true });
    }
    // Routing selon le type
    switch (n.type) {
      case 'challenge_received': router.push(`/challenge/active?challengeId=${n.payload?.challengeId}`); break;
      case 'challenge_completed': router.push('/challenge/history'); break;
      case 'tournament_start': router.push('/tournament/list'); break;
      case 'friend_request': router.push('/friends'); break;
      case 'reward_issued': router.push('/rewards'); break;
      default: break;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, color: '#FCD34D', fontWeight: '900' }}>Notifications</Text>
      </View>
      <FlatList data={items} keyExtractor={(n) => n._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onTap(item)}
            style={{ marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 12,
              backgroundColor: item.readAt ? '#152A47' : '#1e3a5f',
              borderLeftWidth: item.readAt ? 0 : 3, borderLeftColor: '#FCD34D' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{ICONS[item.type]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: '#93C5FD', marginTop: 4 }}>{item.body}</Text>
                <Text style={{ color: '#6B7280', marginTop: 6, fontSize: 11 }}>
                  {new Date(item.sentAt).toLocaleString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: '#93C5FD', textAlign: 'center', padding: 40 }}>Boite vide.</Text>}
      />
    </SafeAreaView>
  );
}
