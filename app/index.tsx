/**
 * @file index.tsx
 * @description Entry point / auth router for the Belote app. Redirects to tabs if authenticated, otherwise to the welcome screen.
 * @author Idriss Kriouile
 * @date 2026-04-05
 * @project SallyCards - Belote
 */

import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as api from '../shared/api';

export default function Index() {
  // Check if user has an active auth token
  const token = api.getAuthToken();

  // useEffect: Logs component mount and auth state for debugging
  useEffect(() => {
    console.log('[Belote/index] Component mounted');
    console.log('[Belote/index] Auth token present:', !!token);
  }, []);

  // If token exists, user is authenticated — redirect to main tabs
  if (token) {
    console.log('[Belote/index] Navigating to /(tabs)');
    return <Redirect href="/(tabs)" />;
  }

  // No token — redirect to welcome/onboarding flow
  console.log('[Belote/index] Navigating to /auth/welcome');
  return <Redirect href="/auth/welcome" />;
}

/* === End of index.tsx — Belote — SallyCards === */
