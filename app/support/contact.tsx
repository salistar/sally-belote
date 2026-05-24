/**
 * @file support/contact.tsx
 * @description Formulaire de contact support. POST /support/tickets.
 *   Fallback : ouvre le client mail (mailto) si l'API échoue.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as api from '../../shared/api';

const SUBJECTS = ['Bug', 'Paiement', 'Compte', 'Suggestion', 'Autre'];
const SUPPORT_EMAIL = 'salistarcompany@gmail.com';

export default function ContactScreen() {
  const [subject, setSubject] = useState('Bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (message.trim().length < 10) {
      Alert.alert('Message trop court', 'Décris ton problème en quelques mots (10 caractères min).');
      return;
    }
    setSending(true);
    try {
      await api.post('/support/tickets', { subject, message });
      Alert.alert('Envoyé', 'Notre équipe te répondra par email sous 48h.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      // Fallback : ouvre le client mail
      const body = encodeURIComponent(message);
      const subj = encodeURIComponent(`[Support Belote] ${subject}`);
      const url = `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`;
      const can = await Linking.canOpenURL(url);
      if (can) { Linking.openURL(url); router.back(); }
      else Alert.alert('Erreur', "Impossible d'envoyer. Écris à " + SUPPORT_EMAIL);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Contacter le support</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={s.label}>Sujet</Text>
        <View style={s.subjectRow}>
          {SUBJECTS.map((sub) => (
            <TouchableOpacity
              key={sub}
              onPress={() => setSubject(sub)}
              style={[s.subjectPill, subject === sub && s.subjectPillActive]}
            >
              <Text style={[s.subjectText, subject === sub && s.subjectTextActive]}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { marginTop: 20 }]}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          placeholder="Décris ton problème ou ta suggestion…"
          placeholderTextColor="#6B7280"
          style={s.input}
        />

        <View style={s.emailHint}>
          <Ionicons name="information-circle-outline" size={14} color="#93C5FD" />
          <Text style={s.emailHintText}>Réponse par email à l'adresse de ton compte.</Text>
        </View>

        <TouchableOpacity style={s.sendBtn} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color="#0A1F44" /> : <Text style={s.sendText}>Envoyer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  label: { color: '#93C5FD', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#152A47' },
  subjectPillActive: { backgroundColor: '#FCD34D' },
  subjectText: { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
  subjectTextActive: { color: '#0A1F44' },
  input: { backgroundColor: '#152A47', borderRadius: 12, color: '#fff', padding: 14, minHeight: 130, textAlignVertical: 'top', fontSize: 14 },
  emailHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  emailHintText: { color: '#93C5FD', fontSize: 12 },
  sendBtn: { backgroundColor: '#FCD34D', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 24 },
  sendText: { color: '#0A1F44', fontSize: 16, fontWeight: '900' },
});
