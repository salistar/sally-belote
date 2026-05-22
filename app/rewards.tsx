/**
 * @file rewards.tsx
 * @description Recompenses : bons d'achat + badges + progression niveau.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../shared/api';
import * as Clipboard from 'expo-clipboard';

interface Voucher {
  code: string;
  amount: number;
  currency: string;
  providerStoreCode: string;
  status: 'issued' | 'claimed' | 'expired';
  expiresAt: string;
  reason: string;
}

interface Level { level: number; xp: number; nextLevelXp: number; unlockedFeatures: string[] }

export default function RewardsScreen() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [level, setLevel] = useState<Level | null>(null);

  useEffect(() => {
    api.get<Voucher[]>('/rewards/vouchers').then(setVouchers).catch(() => {});
    api.get<Level>('/levels/me?gameType=belote').then(setLevel).catch(() => {});
  }, []);

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copie', `Code ${code} copie dans le presse-papier`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, color: '#FCD34D', fontWeight: '900' }}>Recompenses</Text>
      </View>

      {/* Bloc niveau */}
      {level && (
        <View style={{ marginHorizontal: 20, padding: 16, backgroundColor: '#152A47', borderRadius: 14 }}>
          <Text style={{ color: '#93C5FD' }}>Niveau actuel</Text>
          <Text style={{ color: '#FCD34D', fontSize: 36, fontWeight: '900' }}>Niveau {level.level}</Text>
          <View style={{ height: 10, backgroundColor: '#0A1F44', borderRadius: 5, marginTop: 8, overflow: 'hidden' }}>
            <View style={{ height: 10, width: `${(level.xp / level.nextLevelXp) * 100}%`, backgroundColor: '#10B981' }} />
          </View>
          <Text style={{ color: '#fff', marginTop: 6 }}>
            {level.xp} / {level.nextLevelXp} XP
          </Text>
          {level.unlockedFeatures.length > 0 && (
            <Text style={{ color: '#34d399', marginTop: 8 }}>
              Debloques : {level.unlockedFeatures.join(', ')}
            </Text>
          )}
        </View>
      )}

      <Text style={{ color: '#FCD34D', fontSize: 18, fontWeight: '700', marginHorizontal: 20, marginTop: 24, marginBottom: 8 }}>
        Bons d'achat
      </Text>

      <FlatList
        data={vouchers}
        keyExtractor={(v) => v.code}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: '#152A47', borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FCD34D', fontSize: 22, fontWeight: '900' }}>
                  {item.amount} {item.currency}
                </Text>
                <Text style={{ color: '#93C5FD', marginTop: 2 }}>
                  {item.providerStoreCode.toUpperCase()} · {item.reason}
                </Text>
                <Text style={{ color: '#fff', marginTop: 6, fontFamily: 'monospace' }}>{item.code}</Text>
                <Text style={{ color: '#9CA3AF', marginTop: 2, fontSize: 12 }}>
                  Expire le {new Date(item.expiresAt).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => copyCode(item.code)}
                style={{ padding: 10, backgroundColor: '#3B82F6', borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Copier</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: '#93C5FD', textAlign: 'center', padding: 40 }}>
            Aucun bon pour le moment. Sois le #1 dans tous les classements pour gagner 100€ !
          </Text>
        }
      />
    </SafeAreaView>
  );
}
