/**
 * @file challenge/create.tsx
 * @description Donne un challenge sport au perdant (apres victoire).
 * - Choix marche / course
 * - Slider distance 200m - 5km
 * - Slider temps limite 15min - 2h
 * - Selection point A (position actuelle) et point B (carte)
 * - POST /api/v1/challenges/sport
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as api from '../../shared/api';
import * as Location from 'expo-location';

type ChallengeType = 'walk' | 'run';

export default function CreateChallengeScreen() {
  const { opponentId } = useLocalSearchParams<{ opponentId: string }>();
  const [type, setType] = useState<ChallengeType>('walk');
  const [distanceM, setDistanceM] = useState(1000);
  const [timeLimitMin, setTimeLimitMin] = useState(30);
  const [pointA, setPointA] = useState<{ lat: number; lng: number } | null>(null);
  const [pointB, setPointB] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        setPointA({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  async function submit() {
    if (!pointA || !pointB || !opponentId) {
      Alert.alert('Erreur', 'Choisir 2 points et un destinataire');
      return;
    }
    setLoading(true);
    try {
      await api.post('/challenges/sport', {
        receiverId: opponentId,
        gameType: 'belote',
        type,
        distanceMeters: distanceM,
        deadlineAt: new Date(Date.now() + timeLimitMin * 60 * 1000).toISOString(),
        pointA,
        pointB,
      });
      Alert.alert('OK', 'Challenge envoye !');
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Echec');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 28, color: '#FCD34D', fontWeight: '900' }}>Donner un challenge</Text>
        <Text style={{ color: '#93C5FD', marginTop: 6 }}>Marche ou course de A vers B, avec deadline.</Text>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          {(['walk', 'run'] as ChallengeType[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setType(t)}
              style={{
                flex: 1, padding: 16, borderRadius: 12,
                backgroundColor: type === t ? '#FCD34D' : '#152A47',
                alignItems: 'center',
              }}>
              <Text style={{ fontSize: 24 }}>{t === 'walk' ? '🚶' : '🏃'}</Text>
              <Text style={{ color: type === t ? '#0A1F44' : '#fff', fontWeight: '700' }}>
                {t === 'walk' ? 'Marche' : 'Course'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#fff', marginTop: 20 }}>Distance : {distanceM} m</Text>
        {/* Slider simple via boutons +/- (eviter dependance @react-native-community/slider) */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {[200, 500, 1000, 2000, 5000].map((d) => (
            <TouchableOpacity key={d} onPress={() => setDistanceM(d)}
              style={{
                flex: 1, padding: 10, borderRadius: 8,
                backgroundColor: distanceM === d ? '#3B82F6' : '#152A47',
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff' }}>{d}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: '#fff', marginTop: 20 }}>Temps limite : {timeLimitMin} min</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {[15, 30, 60, 90, 120].map((m) => (
            <TouchableOpacity key={m} onPress={() => setTimeLimitMin(m)}
              style={{
                flex: 1, padding: 10, borderRadius: 8,
                backgroundColor: timeLimitMin === m ? '#3B82F6' : '#152A47',
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff' }}>{m}min</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: 20, padding: 12, backgroundColor: '#152A47', borderRadius: 10 }}>
          <Text style={{ color: '#93C5FD' }}>Point A (depart) :</Text>
          <Text style={{ color: '#fff' }}>
            {pointA ? `${pointA.lat.toFixed(5)}, ${pointA.lng.toFixed(5)}` : 'Localisation en cours…'}
          </Text>
          <Text style={{ color: '#93C5FD', marginTop: 8 }}>Point B (arrivee) :</Text>
          <Text style={{ color: '#fff' }}>
            {pointB ? `${pointB.lat.toFixed(5)}, ${pointB.lng.toFixed(5)}` : 'Choisir sur la carte…'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/maps?pickB=1')}
            style={{ marginTop: 8, padding: 10, backgroundColor: '#3B82F6', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Choisir sur la carte</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={submit} disabled={loading}
          style={{
            marginTop: 24, padding: 18, backgroundColor: loading ? '#666' : '#FCD34D',
            borderRadius: 14, alignItems: 'center',
          }}>
          {loading
            ? <ActivityIndicator />
            : <Text style={{ color: '#0A1F44', fontWeight: '900', fontSize: 16 }}>Envoyer le challenge</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
