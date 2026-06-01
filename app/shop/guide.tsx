/**
 * @file shop/guide.tsx
 * @description Guide visuel "À quoi servent les coins et les gemmes ?".
 * Affiche les 2 currencies + le tarif de chaque cadeau / cosmétique /
 * bonus. Accessible depuis le bouton "?" du shop.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

const GOLD = '#FCD34D';
const PINK = '#EC4899';

interface RewardRow { icon: string; label: { fr: string; en: string; ar: string };
                     priceCoins?: number; priceGems?: number; reward?: string }

const COINS_USAGE: RewardRow[] = [
  { icon: 'shuffle-outline',  label: { fr: 'Skin cartes',        en: 'Card skin',       ar: 'تصميم الأوراق' },     priceCoins: 500 },
  { icon: 'image-outline',    label: { fr: 'Tapis de table',     en: 'Table felt',      ar: 'لون الطاولة' },        priceCoins: 800 },
  { icon: 'star-outline',     label: { fr: 'Avatar premium',     en: 'Premium avatar',  ar: 'صورة شخصية مميزة' },    priceCoins: 1000 },
  { icon: 'sparkles-outline', label: { fr: 'Effet de victoire',  en: 'Win effect',      ar: 'تأثير الفوز' },        priceCoins: 1500 },
  { icon: 'flash-outline',    label: { fr: 'Reprise + indice',   en: 'Hint + undo',     ar: 'إعادة + تلميح' },      priceCoins: 100 },
  { icon: 'gift-outline',     label: { fr: 'Offrir à un ami',    en: 'Gift a friend',   ar: 'هدية لصديق' },         priceCoins: 250 },
  { icon: 'chatbubble-outline', label: { fr: 'Sticker chat',     en: 'Chat sticker',    ar: 'ملصق للدردشة' },       priceCoins: 200 },
];

const GEMS_USAGE: RewardRow[] = [
  { icon: 'diamond-outline',  label: { fr: 'Pass VIP 30 jours',  en: 'VIP Pass 30 days', ar: 'VIP لمدة ٣٠ يوماً' },  priceGems: 250 },
  { icon: 'trending-up',      label: { fr: 'Double XP 7 jours',  en: 'Double XP 7 days', ar: 'XP مضاعف ٧ أيام' },    priceGems: 80 },
  { icon: 'shield-checkmark', label: { fr: 'Protection chute',   en: 'Loss shield',      ar: 'حماية من الخسارة' },   priceGems: 50 },
  { icon: 'time-outline',     label: { fr: 'Reprise de partie',  en: 'Match resume',     ar: 'استئناف اللعبة' },     priceGems: 30 },
  { icon: 'rocket-outline',   label: { fr: 'Skip défi du jour',  en: 'Skip daily',       ar: 'تخطي تحدي اليوم' },    priceGems: 20 },
  { icon: 'flame-outline',    label: { fr: 'Conversion gems→coins (1 gem = 100 coins)', en: 'Gems→coins (1=100)', ar: 'تحويل: ١ جوهرة = ١٠٠' }, priceGems: 1, reward: '100 🪙' },
];

const GIFT_TIERS = [
  { tier: 'BRONZE',    coins:  100, gems:  0, label: { fr: 'Petit pourboire', en: 'Small tip',    ar: 'بقشيش صغير' } },
  { tier: 'ARGENT',    coins:  500, gems:  5, label: { fr: 'Bravo !',          en: 'Bravo!',       ar: 'برافو!' } },
  { tier: 'OR',        coins: 1500, gems: 20, label: { fr: 'Champion',         en: 'Champion',     ar: 'بطل' } },
  { tier: 'DIAMANT',   coins: 5000, gems: 80, label: { fr: 'Légende',          en: 'Legend',       ar: 'أسطورة' } },
];

export default function ShopGuide() {
  const { i18n } = useTranslation();
  const lang: 'fr' | 'en' | 'ar' = (i18n.language?.startsWith('en') ? 'en' :
                                     i18n.language?.startsWith('ar') ? 'ar' : 'fr') as any;
  const isRtl = lang === 'ar';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name={isRtl ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>
          {lang === 'fr' ? 'Guide des récompenses' :
           lang === 'en' ? 'Rewards guide' : 'دليل المكافآت'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* ---- COINS ---- */}
        <LinearGradient colors={['#F59E0B', '#D97706']} style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.coinIcon}><Text style={{ fontSize: 28 }}>🪙</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{lang === 'fr' ? 'Sally Coins' : 'Sally Coins'}</Text>
              <Text style={s.heroSub}>
                {lang === 'fr' ? 'Gagnés en jouant. Servent à débloquer les cosmétiques.'
                 : lang === 'en' ? 'Earned by playing. Spend on cosmetics.'
                 : 'تكسبها باللعب. تستخدمها للتجميل.'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={s.sectionLabel}>
          {lang === 'fr' ? 'À quoi servent les Coins ?' :
           lang === 'en' ? 'What can Coins buy?' : 'ماذا تشتري بالعملات؟'}
        </Text>
        {COINS_USAGE.map((r, i) => (
          <Row key={i} row={r} lang={lang} accent={GOLD} />
        ))}

        {/* ---- GEMS ---- */}
        <LinearGradient colors={['#EC4899', '#BE185D']} style={[s.heroCard, { marginTop: 24 }]}>
          <View style={s.heroTop}>
            <View style={[s.coinIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={{ fontSize: 28 }}>💎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{lang === 'fr' ? 'Sally Gemmes' : 'Sally Gems'}</Text>
              <Text style={s.heroSub}>
                {lang === 'fr' ? 'Monnaie premium. Acheter ou gagner via le défi du jour 7/7.'
                 : lang === 'en' ? 'Premium currency. Buy in shop or earn on the 7/7 daily streak.'
                 : 'عملة مميزة. تشتريها أو تكسبها بـ ٧/٧ يومياً.'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={s.sectionLabel}>
          {lang === 'fr' ? 'À quoi servent les Gemmes ?' :
           lang === 'en' ? 'What can Gems do?' : 'ماذا تفعل الجواهر؟'}
        </Text>
        {GEMS_USAGE.map((r, i) => (
          <Row key={i} row={r} lang={lang} accent={PINK} />
        ))}

        {/* ---- GIFT TIERS ---- */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>
          {lang === 'fr' ? 'Cadeaux à offrir' :
           lang === 'en' ? 'Gifts you can send' : 'هدايا للإرسال'}
        </Text>
        {GIFT_TIERS.map((g, i) => (
          <View key={i} style={s.tierRow}>
            <View style={[s.tierBadge, {
              backgroundColor: i === 0 ? '#CD7F32' : i === 1 ? '#C0C0C0' : i === 2 ? GOLD : '#B9F2FF',
            }]}>
              <Text style={s.tierBadgeText}>{g.tier}</Text>
            </View>
            <Text style={s.tierLabel}>{g.label[lang]}</Text>
            <Text style={s.tierPrice}>
              {g.coins > 0 ? `${g.coins} 🪙` : ''}{g.coins > 0 && g.gems > 0 ? '  +  ' : ''}{g.gems > 0 ? `${g.gems} 💎` : ''}
            </Text>
          </View>
        ))}

        <Text style={s.footer}>
          {lang === 'fr' ? 'Les achats sont confirmés côté serveur. Ton solde se met à jour automatiquement après chaque partie.'
           : lang === 'en' ? 'Purchases are confirmed server-side. Your balance updates automatically after every game.'
           : 'تتم تأكيد المشتريات من جانب الخادم. يتم تحديث رصيدك بعد كل لعبة.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ row, lang, accent }: { row: RewardRow; lang: 'fr' | 'en' | 'ar'; accent: string }) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: accent + '22' }]}>
        <Ionicons name={row.icon as any} size={18} color={accent} />
      </View>
      <Text style={s.rowLabel}>{row.label[lang]}</Text>
      <Text style={[s.rowPrice, { color: accent }]}>
        {row.priceCoins ? `${row.priceCoins} 🪙` : `${row.priceGems} 💎`}
        {row.reward ? `  →  ${row.reward}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050d1a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  scroll: { padding: 14, paddingBottom: 40 },

  heroCard: { borderRadius: 18, padding: 18, marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 4 },

  sectionLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#152A47', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' },
  rowPrice: { fontSize: 13, fontWeight: '900' },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#152A47', borderRadius: 12, marginBottom: 6 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  tierBadgeText: { color: '#0A1535', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tierLabel: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' },
  tierPrice: { color: '#FCD34D', fontSize: 13, fontWeight: '900' },

  footer: { marginTop: 24, color: '#64748B', fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
