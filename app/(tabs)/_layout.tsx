/**
 * @file _layout.tsx
 * @description Tab navigation layout for the Belote app. Defines the bottom tab bar with Play, Leaderboard, and Profile tabs.
 * @author Idriss Kriouile
 * @date 2026-04-05
 * @project SallyCards - Belote
 */

import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/** Icône de tab : Ionicons, variante "pleine" quand l'onglet est actif. */
function tabIcon(base: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? base : outline} size={size ?? 22} color={color} />
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    console.log('[Belote/TabsLayout] Component mounted');
  }, []);

  return (
    /* Bottom tab navigator — thème Belote (bleu nuit + accent or) */
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A1F44',
          borderTopColor: 'rgba(252,211,77,0.18)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FCD34D',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('play'), tabBarIcon: tabIcon('game-controller', 'game-controller-outline') }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ title: t('leaderboard'), tabBarIcon: tabIcon('trophy', 'trophy-outline') }}
      />
      <Tabs.Screen
        name="maps"
        options={{ title: t('map') ?? 'Carte', tabBarIcon: tabIcon('map', 'map-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('profile'), tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}

/* === End of _layout.tsx — Belote — SallyCards === */
