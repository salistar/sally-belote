/**
 * @file shop/item-detail.tsx
 * @description Fiche détaillée d'un item boutique (avatar, thème, deck, premium).
 *   GET /shop/items/:id. Bouton "Acheter" → /shop/purchase-confirm.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

interface ShopItem {
  _id: string;
  name: string;
  category: 'avatar' | 'theme' | 'deck' | 'premium' | 'boost';
  description: string;
  priceEur: number;
  priceCoins?: number;
  previewUrl?: string;
  owned?: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  avatar: 'Avatar', theme: 'Thème de table', deck: 'Deck de cartes', premium: 'Premium', boost: 'Boost',
};

export default function ShopItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ShopItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ShopItem>(`/shop/items/${id}`);
      setItem(data);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
        <ActivityIndicator color="#FCD34D" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="bag-remove-outline" size={48} color="#6B7280" />
        <Text style={{ color: '#93C5FD', marginTop: 12 }}>Article introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.cta}><Text style={s.ctaText}>Retour</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{item.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={s.preview}>
          {item.previewUrl
            ? <Image source={{ uri: item.previewUrl }} style={s.previewImg} />
            : <Ionicons name="image-outline" size={64} color="#6B7280" />}
        </View>
        <View style={s.catPill}><Text style={s.catText}>{CATEGORY_LABEL[item.category] ?? item.category}</Text></View>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.desc}>{item.description}</Text>

        <View style={s.priceRow}>
          <Text style={s.priceEur}>{item.priceEur.toFixed(2)} €</Text>
          {item.priceCoins != null && <Text style={s.priceCoins}>ou {item.priceCoins} coins</Text>}
        </View>
      </ScrollView>

      {item.owned ? (
        <View style={[s.buyBtn, { backgroundColor: '#10B981' }]}>
          <Text style={[s.buyText, { color: '#fff' }]}>✓ Possédé</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={s.buyBtn}
          onPress={() => router.push(`/shop/purchase-confirm?itemId=${item._id}&name=${encodeURIComponent(item.name)}&price=${item.priceEur}`)}
        >
          <Ionicons name="cart" size={18} color="#0A1F44" />
          <Text style={s.buyText}>Acheter — {item.priceEur.toFixed(2)} €</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 },
  preview: { height: 200, backgroundColor: '#152A47', borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  catPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(252,211,77,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 16 },
  catText: { color: '#FCD34D', fontSize: 11, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 10 },
  desc: { color: '#93C5FD', fontSize: 14, marginTop: 8, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 20 },
  priceEur: { color: '#FCD34D', fontSize: 28, fontWeight: '900' },
  priceCoins: { color: '#93C5FD', fontSize: 14 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FCD34D', margin: 16, paddingVertical: 16, borderRadius: 14 },
  buyText: { color: '#0A1F44', fontSize: 16, fontWeight: '900' },
  cta: { backgroundColor: '#FCD34D', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  ctaText: { color: '#0A1F44', fontWeight: '900' },
});
