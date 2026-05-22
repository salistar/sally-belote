/**
 * @file shop/purchase-history.tsx
 * @description Historique des achats + factures. GET /shop/purchases.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

interface Purchase {
  _id: string;
  name: string;
  priceEur: number;
  status: 'completed' | 'pending' | 'refunded' | 'failed';
  purchasedAt: string;
  invoiceUrl?: string;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  completed: { color: '#10B981', label: 'Payé' },
  pending: { color: '#F59E0B', label: 'En attente' },
  refunded: { color: '#3B82F6', label: 'Remboursé' },
  failed: { color: '#EF4444', label: 'Échoué' },
};

export default function PurchaseHistoryScreen() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Purchase[]>('/shop/purchases');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
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
        <Text style={s.title}>Mes achats</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#FCD34D" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="receipt-outline" size={42} color="#6B7280" />
              <Text style={{ color: '#6B7280', marginTop: 10 }}>Aucun achat pour le moment</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.pending;
            return (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.date}>{new Date(item.purchasedAt).toLocaleDateString('fr-FR')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.price}>{item.priceEur.toFixed(2)} €</Text>
                  <View style={[s.statusPill, { backgroundColor: meta.color }]}>
                    <Text style={s.statusText}>{meta.label}</Text>
                  </View>
                </View>
              </View>
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
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#152A47', borderRadius: 12, padding: 14, marginBottom: 6 },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  date: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  price: { color: '#FCD34D', fontSize: 15, fontWeight: '900' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
