/**
 * @file level-unlock.tsx
 * @description Écran de déblocage de niveau avec animation. Reçoit en params
 *   le nouveau niveau + features débloquées. Affiché après un gain de niveau.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const FEATURE_LABELS: Record<string, { icon: any; label: string }> = {
  avatar: { icon: 'person-circle', label: 'Nouvel avatar' },
  theme: { icon: 'color-palette', label: 'Nouveau thème' },
  deck: { icon: 'albums', label: 'Nouveau deck' },
  bot: { icon: 'hardware-chip', label: 'Bot plus fort' },
  tournament: { icon: 'trophy', label: 'Tournoi débloqué' },
};

export default function LevelUnlockScreen() {
  const params = useLocalSearchParams<{ level?: string; features?: string }>();
  const level = Number(params.level ?? 2);
  const features = (params.features ?? '').split(',').filter(Boolean);

  const scale = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1F44' }}>
      <LinearGradient colors={['#0A1F44', '#1E1B4B', '#0A1F44']} style={StyleSheet.absoluteFill} />
      <View style={s.body}>
        <Text style={s.kicker}>NIVEAU SUPÉRIEUR</Text>
        <Animated.View style={[s.ring, { transform: [{ scale }], opacity: glow }]}>
          <LinearGradient colors={['#FCD34D', '#F59E0B']} style={s.ringInner}>
            <Text style={s.level}>{level}</Text>
          </LinearGradient>
        </Animated.View>
        <Text style={s.congrats}>Bravo ! Tu passes niveau {level}</Text>

        {features.length > 0 && (
          <View style={s.features}>
            <Text style={s.featuresTitle}>Débloqué :</Text>
            {features.map((f) => {
              const meta = FEATURE_LABELS[f] ?? { icon: 'star', label: f };
              return (
                <View key={f} style={s.featureRow}>
                  <Ionicons name={meta.icon} size={20} color="#FCD34D" />
                  <Text style={s.featureLabel}>{meta.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={s.cta} onPress={() => router.back()}>
          <Text style={s.ctaText}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kicker: { color: '#93C5FD', fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  ring: { marginTop: 24, shadowColor: '#FCD34D', shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  ringInner: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  level: { color: '#0A1F44', fontSize: 56, fontWeight: '900' },
  congrats: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 28, textAlign: 'center' },
  features: { marginTop: 28, alignSelf: 'stretch', backgroundColor: '#152A47', borderRadius: 14, padding: 16 },
  featuresTitle: { color: '#93C5FD', fontSize: 12, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureLabel: { color: '#fff', fontSize: 14 },
  cta: { backgroundColor: '#FCD34D', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14, marginTop: 36 },
  ctaText: { color: '#0A1F44', fontSize: 16, fontWeight: '900' },
});
