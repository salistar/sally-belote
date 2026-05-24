/**
 * @file shared/env.ts
 * @description Sélecteur d'environnement runtime (Local ↔ Prod) pour l'app.
 *
 * L'utilisateur bascule entre "Local" (127.0.0.1 via adb reverse / IP LAN) et
 * "Prod" (VPS Hetzner, salistar.com) depuis Réglages → Environnement. Le choix
 * est persisté (AsyncStorage) et lu DYNAMIQUEMENT par shared/api.ts à chaque
 * appel — donc le toggle prend effet sans rebuild (un reload suffit pour le
 * socket déjà connecté).
 *
 * Priorité de résolution en mode 'local' :
 *   1. EXPO_PUBLIC_API_URL (baké au build)
 *   2. IP de Metro (debuggerHost) + port → suit le Wi-Fi automatiquement
 *   3. 127.0.0.1 (adb reverse)
 */
import Constants from 'expo-constants';

// AsyncStorage défensif (mémoire si le module natif manque) — même approche
// que AppProviders, pour persister le choix d'environnement.
const K_ENV = '@belote/env';
let storage: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };
{
  const mem = new Map<string, string>();
  storage = {
    getItem: async (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k, v) => { mem.set(k, v); },
  };
  try {
    const mod = require('@react-native-async-storage/async-storage');
    const c = mod?.default ?? mod;
    if (c && typeof c.getItem === 'function' && typeof c.setItem === 'function') storage = c;
  } catch {}
}

export type EnvName = 'local' | 'prod';

export interface EnvConfig {
  name: EnvName;
  label: string;
  apiUrl: string;
  socketUrl: string;
  /** Hôte TURN/STUN (les credentials tournants viennent de /api/turn-creds). */
  turnHost: string;
}

// ── Détection dynamique de l'hôte en mode local ────────────────────────────
function metroHost(): string | null {
  const hostUri =
    (Constants as any).expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const host = String(hostUri).split(':')[0];
    if (host) return host;
  }
  return null;
}

function localApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const h = metroHost();
  if (h) return `http://${h}:3000/api/v1`;
  return 'http://127.0.0.1:3000/api/v1';
}

function localSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) return process.env.EXPO_PUBLIC_SOCKET_URL;
  const h = metroHost();
  if (h) return `http://${h}:3001`;
  return 'http://127.0.0.1:3001';
}

// ── Définition des 2 environnements ────────────────────────────────────────
export const PROD_ENV: EnvConfig = {
  name: 'prod',
  label: 'Production · salistar.com',
  apiUrl: 'https://api.salistar.com/api/v1',
  socketUrl: 'https://ws.salistar.com',
  turnHost: 'turn.salistar.com',
};

export function localEnv(): EnvConfig {
  return {
    name: 'local',
    label: 'Local · 127.0.0.1',
    apiUrl: localApiUrl(),
    socketUrl: localSocketUrl(),
    turnHost: '127.0.0.1',
  };
}

// ── État runtime + listeners ───────────────────────────────────────────────
const DEFAULT_ENV: EnvName = (process.env.EXPO_PUBLIC_DEFAULT_ENV as EnvName) || 'local';
let current: EnvName = DEFAULT_ENV;
const listeners = new Set<() => void>();

export function getEnvName(): EnvName {
  return current;
}

export function getEnv(): EnvConfig {
  return current === 'prod' ? PROD_ENV : localEnv();
}

export function getApiUrl(): string {
  return getEnv().apiUrl;
}

export function getSocketUrl(): string {
  return getEnv().socketUrl;
}

export function getTurnHost(): string {
  return getEnv().turnHost;
}

/** Change l'environnement actif, persiste le choix, et notifie les abonnés. */
export function setEnvName(name: EnvName) {
  if (name === current) return;
  current = name;
  storage.setItem(K_ENV, name).catch(() => {});
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

/** S'abonner aux changements d'env (retourne une fonction de désinscription). */
export function onEnvChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Applique une valeur hydratée depuis le stockage (au démarrage). */
export function hydrateEnvName(name: string | null | undefined) {
  if (name === 'local' || name === 'prod') current = name;
}
