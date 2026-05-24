/**
 * @file support/help.tsx
 * @description FAQ / aide. Liste d'items dépliables + lien vers contact.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Comment jouer à la Belote contre des bots ?', a: "Depuis l'accueil, touche « vs Bot ». Tu affrontes 3 bots ; choisis la difficulté dans les paramètres ou via le mode Coinche pour les contrats." },
  { q: 'Comment fonctionne le mode Coinche ?', a: "Chaque joueur annonce un contrat (80 à Capot) sur une couleur. Le plus haut contrat l'emporte. Les adversaires peuvent coincher (x2) ou sur-coincher (x4)." },
  { q: 'Qu\'est-ce qu\'un défi sport ?', a: "Après une victoire, tu peux imposer au perdant un parcours à pied ou en course d'un point A à B. Le trajet est suivi en GPS et partageable sur les réseaux." },
  { q: 'Comment gagner le bon d\'achat 100 € ?', a: "Termine #1 simultanément dans les 5 classements (jour, semaine, mois, week-end, saison). Le code voucher est envoyé par email + notification." },
  { q: 'Mes pièces ont disparu, que faire ?', a: "Vérifie ton historique d'achats dans la boutique. Si une transaction est manquante, contacte le support avec ton ID de transaction." },
  { q: 'Comment changer la langue ?', a: "Profil → Paramètres → Langue. L'app supporte français, anglais, arabe, espagnol et darija." },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(null);

  function toggle(i: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === i ? null : i);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Aide & FAQ</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {FAQ.map((item, i) => (
          <TouchableOpacity key={i} style={s.card} activeOpacity={0.8} onPress={() => toggle(i)}>
            <View style={s.qRow}>
              <Text style={s.q}>{item.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color="#FCD34D" />
            </View>
            {open === i && <Text style={s.a}>{item.a}</Text>}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.contactBtn} onPress={() => router.push('/support/contact')}>
          <Ionicons name="mail" size={18} color="#0A1F44" />
          <Text style={s.contactText}>Contacter le support</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: '#152A47', borderRadius: 12, padding: 16, marginBottom: 8 },
  qRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  q: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  a: { color: '#93C5FD', fontSize: 13, lineHeight: 20, marginTop: 10 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FCD34D', paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  contactText: { color: '#0A1F44', fontSize: 15, fontWeight: '900' },
});
