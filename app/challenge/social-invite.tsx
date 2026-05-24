/**
 * @file challenge/social-invite.tsx
 * @description Défier un inconnu via réseaux sociaux (deep-link magique).
 *   POST /external-invites → renvoie un token + url. Partage natif.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Share, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as api from '../../shared/api';

const CHANNELS: { id: string; label: string; icon: any; color: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#000000' },
  { id: 'sms', label: 'SMS', icon: 'chatbubble-ellipses', color: '#3B82F6' },
];

export default function SocialInviteScreen() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureLink = useCallback(async (): Promise<string> => {
    if (link) return link;
    setLoading(true);
    try {
      const res = await api.post<{ url: string; token: string }>('/external-invites', { game: 'belote' });
      const url = res?.url || `https://salistar.com/c/${res?.token ?? 'demo'}?game=belote`;
      setLink(url);
      return url;
    } catch {
      // Fallback local si l'endpoint n'est pas prêt
      const fallback = `https://salistar.com/c/demo?game=belote`;
      setLink(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [link]);

  const shareTo = useCallback(async (channel: string) => {
    const url = await ensureLink();
    const message = `Je te défie sur SallyCards Belote ! 🎴 Rejoins-moi : ${url} (via ${channel})`;
    try { await Share.share({ message, url }); } catch { /* annulé */ }
  }, [ensureLink]);

  const copyLink = useCallback(async () => {
    const url = await ensureLink();
    await Clipboard.setStringAsync(url);
    Alert.alert('Lien copié', url);
  }, [ensureLink]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Défier un ami</Text>
      </View>

      <View style={s.body}>
        <Ionicons name="paper-plane" size={48} color="#FCD34D" />
        <Text style={s.lead}>Invite n'importe qui — même sans l'app installée</Text>
        <Text style={s.sub}>
          Un lien magique ouvrira le jeu (ou le store), et le défi sera réclamé automatiquement.
        </Text>

        {loading && <ActivityIndicator color="#FCD34D" style={{ marginTop: 16 }} />}

        <View style={s.grid}>
          {CHANNELS.map((c) => (
            <TouchableOpacity key={c.id} style={s.channel} onPress={() => shareTo(c.id)}>
              <View style={[s.channelIcon, { backgroundColor: c.color }]}>
                <Ionicons name={c.icon} size={26} color="#fff" />
              </View>
              <Text style={s.channelLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.copyBtn} onPress={copyLink}>
          <Ionicons name="link" size={18} color="#0A1F44" />
          <Text style={s.copyText}>Copier le lien</Text>
        </TouchableOpacity>
        {link && <Text style={s.linkPreview} numberOfLines={1}>{link}</Text>}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  body: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 12 },
  lead: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  sub: { color: '#93C5FD', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 22, marginTop: 36 },
  channel: { alignItems: 'center', gap: 6 },
  channelIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  channelLabel: { color: '#fff', fontSize: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FCD34D', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 40 },
  copyText: { color: '#0A1F44', fontSize: 14, fontWeight: '900' },
  linkPreview: { color: '#6B7280', fontSize: 11, marginTop: 12, maxWidth: '90%' },
});
