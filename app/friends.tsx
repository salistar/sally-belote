/**
 * @file friends.tsx
 * @description Liste d'amis + recherche + invitation (matchmaking prive).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../shared/api';
import { router } from 'expo-router';

interface Friend { _id: string; username: string; status: 'pending' | 'accepted' | 'blocked'; online: boolean }

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => { reload(); }, []);
  function reload() {
    api.get<Friend[]>('/friends').then(setFriends).catch(() => {});
  }

  async function add() {
    if (query.trim().length < 3) return;
    try {
      await api.post('/friends', { usernameOrEmail: query });
      Alert.alert('Demande envoyee');
      setQuery('');
      reload();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Echec');
    }
  }

  async function accept(friendId: string) {
    await api.patch(`/friends/${friendId}`, { status: 'accepted' });
    reload();
  }

  async function challenge(friend: Friend) {
    const room = await api.post<{ code: string }>('/rooms', { gameType: 'belote', isPrivate: true, invitedUserId: friend._id });
    router.push(`/room/lobby?code=${room.code}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, color: '#FCD34D', fontWeight: '900' }}>Mes amis</Text>
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Username ou email"
            placeholderTextColor="#6B7280"
            style={{ flex: 1, padding: 12, backgroundColor: '#152A47', borderRadius: 10, color: '#fff' }} />
          <TouchableOpacity onPress={add}
            style={{ paddingHorizontal: 18, justifyContent: 'center', backgroundColor: '#FCD34D', borderRadius: 10 }}>
            <Text style={{ color: '#0A1F44', fontWeight: '900' }}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push('/challenge/social-invite')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: '#152A47', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)' }}>
          <Text style={{ fontSize: 16 }}>📲</Text>
          <Text style={{ color: '#FCD34D', fontWeight: '800' }}>Défier un inconnu (WhatsApp, Insta…)</Text>
        </TouchableOpacity>
      </View>
      <FlatList data={friends} keyExtractor={(f) => f._id}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 20, marginBottom: 10, padding: 14, backgroundColor: '#152A47', borderRadius: 10,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.online ? '#10B981' : '#6B7280' }} />
              <Text style={{ color: '#fff', fontWeight: '700' }}>{item.username}</Text>
              {item.status === 'pending' && <Text style={{ color: '#FCD34D' }}>(en attente)</Text>}
            </View>
            {item.status === 'pending'
              ? <TouchableOpacity onPress={() => accept(item._id)}
                  style={{ padding: 8, backgroundColor: '#10B981', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Accepter</Text>
                </TouchableOpacity>
              : <TouchableOpacity onPress={() => challenge(item)} disabled={!item.online}
                  style={{ padding: 8, backgroundColor: item.online ? '#3B82F6' : '#374151', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Defier</Text>
                </TouchableOpacity>}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: '#93C5FD', textAlign: 'center', padding: 40 }}>Aucun ami pour le moment.</Text>}
      />
    </SafeAreaView>
  );
}
