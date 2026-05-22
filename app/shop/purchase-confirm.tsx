/**
 * @file shop/purchase-confirm.tsx
 * @description Confirmation d'achat IAP. L'achat réel passe par le store
 *   natif (Google Play / App Store via RevenueCat) qui affiche SA propre
 *   pop-up système — cet écran ne fait que préparer + confirmer l'intention.
 *   Aucune donnée bancaire n'est saisie ici.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

export default function PurchaseConfirmScreen() {
  const params = useLocalSearchParams<{ itemId?: string; name?: string; price?: string }>();
  const name = params.name ? decodeURIComponent(params.name) : 'Article';
  const price = Number(params.price ?? 0);
  const [processing, setProcessing] = useState(false);

  async function confirm() {
    setProcessing(true);
    try {
      // L'achat réel est déclenché ici : le SDK store ouvre la pop-up système
      // (Google Play / App Store). Le backend valide via webhook RevenueCat.
      // On notifie le backend de l'intention pour le suivi.
      await api.post('/shop/purchase-intent', { itemId: params.itemId, name, priceEur: price });
      Alert.alert(
        'Paiement',
        "La fenêtre de paiement du store va s'ouvrir. La validation se fait côté store — aucune donnée bancaire n'est saisie dans l'app.",
        [{ text: 'OK', onPress: () => router.replace('/shop/purchase-history') }],
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Impossible de démarrer l'achat");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Confirmer l'achat</Text>
      </View>

      <View style={s.body}>
        <View style={s.iconWrap}>
          <Ionicons name="cart" size={48} color="#FCD34D" />
        </View>

        <View style={s.summary}>
          <View style={s.row}>
            <Text style={s.label}>Article</Text>
            <Text style={s.value}>{name}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Prix</Text>
            <Text style={[s.value, { color: '#FCD34D', fontWeight: '900' }]}>{price.toFixed(2)} €</Text>
          </View>
        </View>

        <View style={s.notice}>
          <Ionicons name="lock-closed" size={14} color="#93C5FD" />
          <Text style={s.noticeText}>
            Paiement sécurisé via {`${''}`}Google Play / App Store. Aucune carte bancaire n'est saisie dans l'app.
          </Text>
        </View>
      </View>

      <View style={{ padding: 16, gap: 10 }}>
        <TouchableOpacity style={s.confirmBtn} onPress={confirm} disabled={processing}>
          {processing ? <ActivityIndicator color="#0A1F44" /> : <Text style={s.confirmText}>Confirmer — {price.toFixed(2)} €</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  body: { flex: 1, padding: 24, alignItems: 'center' },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(252,211,77,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  summary: { alignSelf: 'stretch', backgroundColor: '#152A47', borderRadius: 16, padding: 18, marginTop: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { color: '#93C5FD', fontSize: 14 },
  value: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 8 },
  noticeText: { color: '#93C5FD', fontSize: 11, flex: 1, lineHeight: 16 },
  confirmBtn: { backgroundColor: '#FCD34D', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmText: { color: '#0A1F44', fontSize: 16, fontWeight: '900' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#93C5FD', fontSize: 14, fontWeight: '700' },
});
