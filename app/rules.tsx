/**
 * @file rules.tsx
 * @description Ecran "Regles de la Belote" — multi-variantes (7 variantes
 * officielles) avec switch de variante en haut, et 5 sections depliables
 * par variante (Presentation / Encheres / Scoring / Bonus / Fin de manche).
 * Toutes les langues (FR/EN/AR/ES/Darija) viennent du data file.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, LayoutAnimation,
  Platform, UIManager, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { VARIANTS, VariantId, Lang } from '../src/data/belote-variants';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RulesScreen() {
  const { i18n } = useTranslation();
  const lang: Lang = useMemo(() => {
    const raw = (i18n.language || 'fr').toLowerCase();
    if (raw.startsWith('en')) return 'en';
    if (raw.startsWith('ar')) return 'ar';
    if (raw.startsWith('es')) return 'es';
    if (raw === 'darija' || raw === 'ma') return 'darija';
    return 'fr';
  }, [i18n.language]);
  const isRtl = lang === 'ar';

  const [variantId, setVariantId] = useState<VariantId>('classique');
  const [openSection, setOpenSection] = useState<string | null>('overview');

  const variant = VARIANTS.find(v => v.id === variantId) || VARIANTS[0];

  const toggle = (k: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection(openSection === k ? null : k);
  };

  const sections: Array<{ key: keyof typeof variant.i18n; icon: any; title: Record<Lang, string> }> = [
    { key: 'overview', icon: 'information-circle-outline',
      title: { fr: 'Présentation', en: 'Overview', ar: 'مقدمة', es: 'Presentación', darija: 'تقديم' } },
    { key: 'bidding', icon: 'megaphone-outline',
      title: { fr: 'Enchères', en: 'Bidding', ar: 'المزايدات', es: 'Apuestas', darija: 'المزايدات' } },
    { key: 'scoring', icon: 'calculator-outline',
      title: { fr: 'Valeur des cartes', en: 'Card values', ar: 'قيم الأوراق', es: 'Valor de cartas', darija: 'قيمة الأوراق' } },
    { key: 'bonuses', icon: 'star-outline',
      title: { fr: 'Primes & annonces', en: 'Bonuses & sequences', ar: 'المكافآت', es: 'Primas y secuencias', darija: 'البونوسات' } },
    { key: 'endgame', icon: 'trophy-outline',
      title: { fr: 'Fin de partie', en: 'End of game', ar: 'نهاية اللعبة', es: 'Fin de partida', darija: 'نهاية اللعبة' } },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityLabel="Back">
          <Ionicons name={isRtl ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>
          {lang === 'fr' ? 'Règles de la Belote'
           : lang === 'en' ? 'Belote Rules'
           : lang === 'ar' ? 'قواعد البلوت'
           : lang === 'es' ? 'Reglas de la Belote'
           : 'قواعد البلوت'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 12 }}
      >
        {VARIANTS.map(v => {
          const active = v.id === variantId;
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setVariantId(v.id);
              }}
              style={[s.chip, active && s.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={s.chipEmoji}>{v.emoji}</Text>
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {v.i18n.name[lang]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll}>
        <LinearGradient
          colors={['#2563EB', '#1E3A8A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <Text style={s.heroTitle}>
            {variant.emoji}  {variant.i18n.name[lang]}
          </Text>
          <Text style={s.heroTag}>{variant.i18n.tagline[lang]}</Text>
          <View style={s.metaRow}>
            <Meta label={lang === 'fr' ? 'Joueurs' : 'Players'} value={variant.players.join('/')} />
            <Meta label={lang === 'fr' ? 'Cartes' : 'Cards'} value={String(variant.deckSize)} />
            <Meta label={lang === 'fr' ? 'But' : 'Target'} value={`${variant.target} pts`} />
          </View>
        </LinearGradient>

        {sections.map(sec => {
          const open = openSection === sec.key;
          return (
            <View key={sec.key} style={s.card}>
              <TouchableOpacity onPress={() => toggle(sec.key)} style={s.cardHead} activeOpacity={0.85}>
                <View style={s.iconBox}>
                  <Ionicons name={sec.icon as any} size={18} color="#FCD34D" />
                </View>
                <Text style={s.cardTitle}>{sec.title[lang]}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              {open && (
                <View style={s.cardBody}>
                  <Text style={[s.p, isRtl && { textAlign: 'right' }]}>
                    {variant.i18n[sec.key][lang]}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {variant.id === 'belote-marocaine' && (
          <View style={s.hkimBanner}>
            <Ionicons name="football-outline" size={24} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={s.hkimTitle}>
                {lang === 'fr' ? 'Hkim — challenge sportif'
                 : lang === 'en' ? 'Hkim — sport challenge'
                 : lang === 'ar' ? 'الحكم — تحدي رياضي'
                 : lang === 'es' ? 'Hkim — reto deportivo'
                 : 'الحكم — تحدي رياضي'}
              </Text>
              <Text style={s.hkimSub}>
                {lang === 'fr' ? 'À la fin de la partie, le gagnant trace un parcours sur la carte. Le perdant doit le faire à pied ou en courant, puis partager sur les réseaux.'
                 : lang === 'en' ? 'At the end of the game, the winner draws a route on the map. The loser must walk/run it and share on socials.'
                 : lang === 'ar' ? 'في نهاية اللعبة، الفائز يرسم مساراً على الخريطة. الخاسر يجب أن يمشيه ويشاركه على وسائل التواصل.'
                 : lang === 'es' ? 'Al final de la partida, el ganador dibuja una ruta en el mapa. El perdedor debe recorrerla y compartirla en redes.'
                 : 'فلخر اللعبة، الرابح كيرسم طريق فالخريطة. الخاسر خاصو يمشيها ويشيرها فالشبكات.'}
              </Text>
            </View>
          </View>
        )}

        <Text style={s.footer}>
          {lang === 'fr' ? 'Sources : FFB · Wikipedia · Éditions Pole'
           : lang === 'en' ? 'Sources: FFB · Wikipedia · Pole Editions'
           : lang === 'ar' ? 'المصادر: FFB · ويكيبيديا'
           : lang === 'es' ? 'Fuentes: FFB · Wikipedia'
           : 'المصادر: FFB · ويكيبيديا'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.meta}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050d1a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  scroll: { padding: 14, paddingBottom: 32 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, backgroundColor: '#152A47',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#60A5FA' },
  chipEmoji: { fontSize: 16 },
  chipText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  heroCard: {
    borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  heroTag: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600', marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 10 },
  meta: {
    flex: 1, alignItems: 'center',
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  metaLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { color: '#FCD34D', fontSize: 15, fontWeight: '900', marginTop: 4 },

  card: { backgroundColor: '#152A47', borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(252,211,77,0.15)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14 },
  p: { color: '#CBD5E1', fontSize: 13, lineHeight: 21 },

  hkimBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginTop: 12,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)',
  },
  hkimTitle: { color: '#10B981', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  hkimSub: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 18 },
});
