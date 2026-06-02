/**
 * @file shop.tsx
 * @description Boutique Sally Coins pour Belote. Liste des packages depuis
 * `/shop/packages`, achat via RevenueCat (stub — la clé SDK sera fournie via
 * secret EAS), confirmation côté backend qui crédite le portefeuille.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import AppHeader from '../src/components/AppHeader';
import { useTheme } from '../src/contexts/AppProviders';
import { logger } from '../src/utils/logger';
import * as api from '../shared/api';

const HERO = require('../assets/hero/leaderboard-gold.jpg');
const log = logger.scoped('ShopScreen');

export default function ShopScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<api.ShopPackage[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [vip, setVip] = useState<{ isVip: boolean; vipUntil: string | null } | null>(null);
  const [user, setUser] = useState<api.User | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    log.screen('mounted');
    (async () => {
      try {
        log.bin('GET /shop/packages + /shop/items');
        const [pkgs, u] = await Promise.all([api.getShopPackages(), api.getMe()]);
        log.bout('200 /shop/packages', `${pkgs.length} packs`);
        log.explain('packages et utilisateur chargés — rendu de la boutique');
        setPackages(pkgs);
        setUser(u);
        // Items cosmétiques + statut VIP (best-effort, non bloquant)
        api.get<any[]>('/shop/items').then((it) => setItems(Array.isArray(it) ? it : [])).catch(() => {});
        api.get<{ isVip: boolean; vipUntil: string | null }>('/shop/vip/status').then(setVip).catch(() => {});
      } catch (e) {
        log.error('init shop failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePurchase = async (pkg: api.ShopPackage) => {
    log.screen('tap purchase', pkg.productId);
    Alert.alert(
      t('confirmPurchase'),
      `${pkg.name} — ${pkg.coins + (pkg.bonus || 0)} coins pour ${pkg.priceEur}€`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Acheter',
          onPress: async () => {
            setPurchasing(pkg.productId);
            try {
              // RevenueCat SDK call goes here once the key is provided:
              // const purchase = await Purchases.purchasePackage(rcPackage);
              // For now we call the backend directly with a fake purchaseId.
              const fakeId = `dev-${Date.now()}`;
              log.apiIn(`RevenueCat Purchases.purchasePackage(${pkg.productId})`);
              log.apiOut(`SUCCESS purchaseId=${fakeId} (stub mode)`);
              log.bin('POST /shop/purchase/confirm', { productId: pkg.productId });
              const out = await api.confirmPurchase('belote', pkg.productId, fakeId, 'android');
              log.bout('200 /shop/purchase/confirm', { amount: out.amount, balance: out.newBalance });
              log.explain(`+${out.amount} coins crédités — nouveau solde ${out.newBalance}`);
              if (user) setUser({ ...user, coins: out.newBalance });
              Alert.alert(
                t('purchaseSuccess'),
                t('purchaseSuccessDesc', { amount: out.amount, balance: out.newBalance }),
              );
            } catch (e: any) {
              log.error('confirmPurchase failed', e?.message);
              Alert.alert(t('error'), e?.message || t('purchaseFailed'));
            } finally {
              setPurchasing(null);
            }
          },
        },
      ],
    );
  };

  // Achat du Pass VIP (Sally Plus) — même flux RevenueCat stub que les coins.
  const purchaseVip = (productId: string, label: string, priceEur: number) => {
    Alert.alert(
      'Sally Plus VIP',
      `${label} — ${priceEur.toFixed(2)} €/${productId.includes('yearly') ? 'an' : 'mois'}\n\nSans pub · double daily reward · avatars exclusifs · tournois VIP · stats avancées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'S\'abonner',
          onPress: async () => {
            setPurchasing(productId);
            try {
              // RevenueCat: await Purchases.purchasePackage(rcPackage) — stub ici.
              const fakeId = `dev-vip-${Date.now()}`;
              const out: any = await api.post('/shop/vip/confirm', { gameType: 'belote', productId, purchaseId: fakeId, platform: 'android' });
              setVip({ isVip: true, vipUntil: out?.vipUntil ?? null });
              Alert.alert('Bienvenue VIP 👑', 'Ton Pass Sally Plus est actif. Profite des avantages !');
            } catch (e: any) {
              Alert.alert(t('error'), e?.message || 'Abonnement impossible');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ],
    );
  };

  const styles = createStyles(palette);

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGradient} style={StyleSheet.absoluteFill} />
      <AppHeader title={t('shop') ?? 'Boutique'} showBack />

      <ImageBackground source={HERO} style={styles.hero}>
        <LinearGradient
          colors={['rgba(10,10,26,0.2)', 'rgba(10,10,26,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Wallet badges + Guide on a single row, Guide pushed RIGHT */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <View style={styles.walletBadge}>
            <Text style={{ fontSize: 16 }}>🪙</Text>
            <Text style={styles.walletValue}>{user?.coins ?? 0}</Text>
          </View>
          <View style={[styles.walletBadge, { backgroundColor: 'rgba(236,72,153,0.20)', borderColor: '#EC4899' }]}>
            <Text style={{ fontSize: 16 }}>💎</Text>
            <Text style={[styles.walletValue, { color: '#fff' }]}>{(user as any)?.gems ?? 0}</Text>
          </View>
          {/* Spacer pushes the Guide chip to the right edge */}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => router.push('/shop/guide')}
            style={[styles.walletBadge, { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.3)' }]}
            activeOpacity={0.85}
          >
            <Ionicons name="help-circle-outline" size={18} color="#fff" />
            <Text style={[styles.walletLabel, { color: '#fff' }]}>Guide</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Boutique</Text>
        <Text style={styles.heroSubtitle}>Achète coins & gemmes, débloque cosmétiques et VIP</Text>
      </ImageBackground>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* ── Pass VIP Sally Plus ── */}
          <View style={{ width: '100%', marginBottom: 12 }}>
            <LinearGradient colors={['#7C3AED', '#D4AF37']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="star" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 18, fontFamily: 'Inter-Black' }}>Sally Plus VIP</Text>
                {vip?.isVip && (
                  <View style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter-Black' }}>ACTIF 👑</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'Inter-SemiBold', marginTop: 6 }}>
                Sans pub · double daily reward · avatars exclusifs · tournois VIP · stats avancées
              </Text>

              {vip?.isVip ? (
                <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter-Bold', marginTop: 12 }}>
                  Actif jusqu'au {vip.vipUntil ? new Date(vip.vipUntil).toLocaleDateString('fr-FR') : '—'}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    disabled={!!purchasing}
                    onPress={() => purchaseVip('sally_plus_monthly', 'Mensuel', 4.99)}
                  >
                    <Text style={{ color: '#fff', fontFamily: 'Inter-Black', fontSize: 15 }}>4,99 €</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>par mois</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    disabled={!!purchasing}
                    onPress={() => purchaseVip('sally_plus_yearly', 'Annuel', 39.99)}
                  >
                    <Text style={{ color: '#7C3AED', fontFamily: 'Inter-Black', fontSize: 15 }}>39,99 €</Text>
                    <Text style={{ color: '#7C3AED', fontSize: 11, fontFamily: 'Inter-SemiBold' }}>par an · -33%</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Articles cosmétiques → fiche détail */}
          {items.length > 0 && (
            <View style={{ width: '100%', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: palette.text, fontFamily: 'Inter-Bold', fontSize: 15 }}>Articles</Text>
                <TouchableOpacity onPress={() => router.push('/shop/purchase-history')}>
                  <Text style={{ color: palette.accent, fontSize: 12, fontFamily: 'Inter-SemiBold' }}>Mes achats</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {items.map((it) => (
                  <TouchableOpacity
                    key={it._id}
                    onPress={() => router.push(`/shop/item-detail?id=${it._id}`)}
                    activeOpacity={0.85}
                    style={{ width: 130, backgroundColor: '#152A47', borderRadius: 14, padding: 12 }}
                  >
                    <Ionicons
                      name={it.category === 'avatar' ? 'person-circle' : it.category === 'theme' ? 'color-palette' : it.category === 'deck' ? 'albums' : it.category === 'premium' ? 'star' : 'flash'}
                      size={26} color="#FCD34D"
                    />
                    <Text numberOfLines={1} style={{ color: '#fff', fontFamily: 'Inter-Bold', fontSize: 13, marginTop: 8 }}>{it.name}</Text>
                    <Text style={{ color: '#FCD34D', fontFamily: 'Inter-Black', fontSize: 14, marginTop: 4 }}>{Number(it.priceEur).toFixed(2)} €</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {packages.map((pkg) => {
            const total = (pkg.coins || 0) + (pkg.bonus || 0);
            const isBuying = purchasing === pkg.productId;
            // Distinguish between coin packs and VIP subscriptions
            const isVipPack = (pkg as any).kind === 'vip'
              || /^Premium\b/i.test(pkg.name)
              || /^(VIP|Sally Plus)\b/i.test(pkg.name)
              || /vip|plus|premium/i.test(pkg.productId);
            const isGemPack = (pkg as any).kind === 'gems'
              || /(gem|gemme|diamond|diamant)/i.test(pkg.name)
              || /(gem|gemme|diamond)/i.test(pkg.productId);
            const unit = isVipPack ? (/yearly|annuel|1\s*an/i.test(pkg.name + pkg.productId) ? '1 an VIP' : 'VIP')
                       : isGemPack ? 'gemmes'
                       : 'coins';
            const unitIcon = isVipPack ? '👑' : isGemPack ? '💎' : '🪙';
            return (
              <TouchableOpacity
                key={pkg.productId}
                onPress={() => !isBuying && handlePurchase(pkg)}
                activeOpacity={0.85}
                style={styles.pkgWrap}
              >
                <LinearGradient
                  colors={(pkg.gradient as [string, string]) || palette.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.pkg, { borderColor: pkg.bestValue ? '#fde047' : 'transparent' }]}
                >
                  {pkg.popular && (
                    <View style={styles.ribbon}>
                      <Text style={styles.ribbonText}>POPULAIRE</Text>
                    </View>
                  )}
                  {pkg.bestValue && (
                    <View style={[styles.ribbon, { backgroundColor: '#fde047' }]}>
                      <Text style={[styles.ribbonText, { color: '#78350F' }]}>MEILLEURE OFFRE</Text>
                    </View>
                  )}
                  <Text style={styles.pkgIcon}>{pkg.icon || unitIcon}</Text>
                  <Text style={styles.pkgName}>{pkg.name}</Text>
                  <Text style={styles.pkgCoins}>{total.toLocaleString()}</Text>
                  <Text style={styles.pkgCoinsLabel}>{unit}</Text>
                  {pkg.bonus > 0 && !isVipPack && (
                    <View style={styles.bonusPill}>
                      <Text style={styles.bonusText}>+{pkg.bonus} bonus</Text>
                    </View>
                  )}
                  <View style={styles.priceBtn}>
                    {isBuying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.priceText}>{pkg.priceEur.toFixed(2)} €</Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={16} color={palette.textSecondary} />
            <Text style={[styles.disclaimerText, { color: palette.textSecondary }]}>
              Les Sally Coins sont une monnaie virtuelle, utilisables uniquement dans l'app.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(palette: ReturnType<typeof useTheme>['palette']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    hero: {
      height: 140,
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    walletBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.5)',
    },
    walletValue: { color: '#F59E0B', fontSize: 16, fontFamily: 'Inter-Black' },
    walletLabel: { color: '#fff', fontSize: 12, fontFamily: 'Inter-SemiBold' },
    heroTitle: {
      color: '#fff', fontSize: 28, fontFamily: 'Inter-Black', letterSpacing: 1,
      textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter-Regular', marginTop: 2,
    },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 40 },
    pkgWrap: { width: '48%', marginBottom: 12 },
    pkg: {
      borderRadius: 18, padding: 16, alignItems: 'center',
      borderWidth: 2, overflow: 'hidden',
      minHeight: 210,
    },
    ribbon: {
      position: 'absolute', top: 8, right: -20,
      transform: [{ rotate: '30deg' }],
      backgroundColor: '#EF4444',
      paddingHorizontal: 18, paddingVertical: 2,
    },
    ribbonText: { color: '#fff', fontSize: 9, fontFamily: 'Inter-Black', letterSpacing: 1 },
    pkgIcon: { fontSize: 44, marginBottom: 6 },
    pkgName: { color: '#fff', fontSize: 15, fontFamily: 'Inter-Black', letterSpacing: 0.5, marginBottom: 8 },
    pkgCoins: { color: '#fff', fontSize: 28, fontFamily: 'Inter-Black' },
    pkgCoinsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
    bonusPill: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 999,
      marginBottom: 8,
    },
    bonusText: { color: '#fff', fontSize: 11, fontFamily: 'Inter-Bold' },
    priceBtn: {
      backgroundColor: 'rgba(0,0,0,0.35)',
      paddingHorizontal: 18, paddingVertical: 8,
      borderRadius: 999,
      minWidth: 80, alignItems: 'center',
    },
    priceText: { color: '#fff', fontSize: 14, fontFamily: 'Inter-Black' },
    disclaimer: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 16, paddingHorizontal: 12,
      width: '100%',
    },
    disclaimerText: { fontSize: 11, fontFamily: 'Inter-Regular', flex: 1 },
  });
}
