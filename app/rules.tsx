/**
 * @file rules.tsx
 * @description Règles complètes de la Belote (française classique, 32 cartes).
 *   Accessible depuis le Home. Sections dépliables.
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

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: '#152A47', borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14 },
  p: { color: '#CBD5E1', fontSize: 13, lineHeight: 21 },
  tr: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tdL: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tdR: { color: '#FCD34D', fontSize: 13, fontWeight: '600' },
});

interface Section { icon: any; title: string; body: React.ReactNode }

function Row({ l, r }: { l: string; r: string }) {
  return (
    <View style={s.tr}>
      <Text style={s.tdL}>{l}</Text>
      <Text style={s.tdR}>{r}</Text>
    </View>
  );
}

const SECTIONS: Section[] = [
  {
    icon: 'people',
    title: 'Présentation',
    body: (
      <Text style={s.p}>
        La Belote se joue à 4 joueurs en 2 équipes (Nord/Sud contre Est/Ouest), avec un jeu
        de 32 cartes. Le but : atteindre 501 (ou 1000) points en remportant des plis et en
        réalisant des contrats. Variantes : Coinche (contrée), sans-atout, tout-atout.
      </Text>
    ),
  },
  {
    icon: 'shuffle',
    title: 'Distribution',
    body: (
      <Text style={s.p}>
        Le donneur distribue 3 puis 2 cartes à chaque joueur (5 cartes), puis retourne une
        carte au centre. 1er tour d'enchère : chacun peut « Prendre » l'atout de la couleur
        retournée ou « Passer ». Si tout le monde passe, 2e tour : on peut choisir une autre
        couleur d'atout. Le preneur reçoit la carte retournée et le reste est distribué (3 et 2).
      </Text>
    ),
  },
  {
    icon: 'flame',
    title: 'Cartes à l\'ATOUT (force ↓ et points)',
    body: (
      <View>
        <Row l="Valet (J)" r="force 1ère · 20 pts" />
        <Row l="9" r="2e · 14 pts" />
        <Row l="As (A)" r="3e · 11 pts" />
        <Row l="10" r="4e · 10 pts" />
        <Row l="Roi (R)" r="5e · 4 pts" />
        <Row l="Dame (D)" r="6e · 3 pts" />
        <Row l="8 puis 7" r="0 pt" />
      </View>
    ),
  },
  {
    icon: 'snow',
    title: 'Cartes HORS atout (force ↓ et points)',
    body: (
      <View>
        <Row l="As (A)" r="force 1ère · 11 pts" />
        <Row l="10" r="2e · 10 pts" />
        <Row l="Roi (R)" r="3e · 4 pts" />
        <Row l="Dame (D)" r="4e · 3 pts" />
        <Row l="Valet (J)" r="5e · 2 pts" />
        <Row l="9, 8, 7" r="0 pt" />
      </View>
    ),
  },
  {
    icon: 'hand-left',
    title: 'Obligations de jeu',
    body: (
      <Text style={s.p}>
        • Fournir : tu dois jouer une carte de la couleur demandée si tu en as.{'\n'}
        • Couper : si tu n'as pas la couleur, tu dois jouer un atout (couper).{'\n'}
        • Monter : si un atout a déjà été joué et que tu coupes aussi, tu dois mettre un atout
        plus fort si tu peux (surcouper).{'\n'}
        • Si ton partenaire est maître du pli, tu peux te défausser librement.
      </Text>
    ),
  },
  {
    icon: 'heart',
    title: 'Belote-Rebelote (+20)',
    body: (
      <Text style={s.p}>
        Si tu possèdes le Roi ET la Dame d'atout, tu annonces « Belote » en jouant la première
        des deux, puis « Rebelote » en jouant la seconde. Cela rapporte +20 points à ton équipe.
      </Text>
    ),
  },
  {
    icon: 'megaphone',
    title: 'Annonces (suites & carrés)',
    body: (
      <Text style={s.p}>
        Annoncées au 1er pli : Tierce (3 cartes qui se suivent, +20), Cinquante (4 cartes, +50),
        Cent (5 cartes, +100). Carrés : 4 Valets (+200), 4 Neufs (+150), 4 As/10/R/D (+100).
        La plus forte annonce d'une équipe annule celles de l'équipe adverse.
      </Text>
    ),
  },
  {
    icon: 'trophy',
    title: '10 de der · Capot · Scoring',
    body: (
      <Text style={s.p}>
        • 10 de der : l'équipe qui remporte le DERNIER pli gagne +10 points.{'\n'}
        • Capot : remporter les 8 plis = +90 points bonus (250 en Coinche).{'\n'}
        • Total des points en jeu : 162 (+ annonces et belote).{'\n'}
        • Contrat : le preneur doit faire au moins 82 points (avec ses annonces). S'il y arrive,
        chaque équipe marque ses points. Sinon il est « dedans » (chute) : tous les points vont
        à l'équipe adverse.{'\n'}
        • Litige 81-81 : les points du preneur sont mis « au greffe » pour la manche suivante.
      </Text>
    ),
  },
  {
    icon: 'flash',
    title: 'Coinche / Contrée',
    body: (
      <Text style={s.p}>
        Variante moderne : au lieu de simplement prendre, on annonce un contrat chiffré (80, 90,
        … jusqu'à Capot). Les adversaires peuvent « coincher » (x2) s'ils pensent que le contrat
        chute, et le preneur « sur-coincher » (x4). Disponible via le bouton Coinche du menu.
      </Text>
    ),
  },
];

export default function RulesScreen() {
  const [open, setOpen] = useState<number | null>(0);
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === i ? null : i);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#152A47']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Règles de la Belote</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {SECTIONS.map((sec, i) => (
          <View key={i} style={s.card}>
            <TouchableOpacity style={s.cardHead} activeOpacity={0.8} onPress={() => toggle(i)}>
              <Ionicons name={sec.icon} size={20} color="#FCD34D" />
              <Text style={s.cardTitle}>{sec.title}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color="#93C5FD" />
            </TouchableOpacity>
            {open === i && <View style={s.cardBody}>{sec.body}</View>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
