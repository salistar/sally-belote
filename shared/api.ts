import { getApiUrl, getSocketUrl, getEnvName, onEnvChange } from './env';

// URL résolue DYNAMIQUEMENT à chaque appel via env.ts (toggle Local/Prod
// runtime depuis Réglages). On ré-exporte les getters pour les consommateurs
// (sockets, TURN). `SOCKET_URL` reste exporté pour rétro-compat (valeur au
// chargement) mais les écrans temps réel doivent appeler getSocketUrl().
export { getApiUrl, getSocketUrl, getEnvName, getTurnHost, getEnv, setEnvName, onEnvChange, hydrateEnvName } from './env';
export type { EnvName, EnvConfig } from './env';

/** @deprecated utilise getSocketUrl() pour la valeur live (toggle runtime). */
export const SOCKET_URL = getSocketUrl();

if (__DEV__) {
  console.log('[api] env →', getEnvName(), '| API →', getApiUrl(), '| Socket →', getSocketUrl());
}

// In-memory token storage
let authToken: string | null = null;
let refreshToken: string | null = null;

// Au changement d'environnement (Local↔Prod), le token courant a été émis par
// l'AUTRE backend (JWT_SECRET différent) → invalide. On le purge pour forcer
// une reconnexion propre sur le nouveau backend après reload.
onEnvChange(() => {
  authToken = null;
  refreshToken = null;
  if (__DEV__) console.log('[api] env changé → tokens purgés, reconnexion requise');
});

export interface User {
  id: string;
  email: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  teamWinRate: number;
  rank: number;
  coins: number;
  achievements: number;
  memberSince: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export interface Room {
  code: string;
  gameType: string;
  status: 'waiting' | 'playing' | 'finished';
  playersCount: number;
  playersMax: number;
  createdAt: string;
}

export interface Bot {
  id: string;
  name: string;
  level: 'easy' | 'medium' | 'hard' | 'expert';
}

// Utility function to handle fetch with error handling.
// `_isRetry` : interne — true quand on rejoue la requête après un refresh,
// pour éviter une boucle infinie de refresh.
async function fetchWithToken(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false,
) {
  const url = `${getApiUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // ── Auto-refresh sur 401 ────────────────────────────────────────────
    // Si l'access token est expiré/invalide, on tente UN refresh via le
    // refresh token puis on rejoue la requête. Si le refresh échoue (ex.
    // token issu d'un AUTRE backend après un switch Local↔Prod, ou refresh
    // token expiré), refreshTokenAsync nettoie les tokens → le 401 remonte
    // et les écrans renvoient vers l'écran de connexion.
    if (
      response.status === 401 &&
      !_isRetry &&
      refreshToken &&
      !endpoint.startsWith('/auth/')
    ) {
      try {
        await refreshTokenAsync();
        return await fetchWithToken(endpoint, options, true);
      } catch {
        // refresh KO → tokens déjà nettoyés ; on laisse le 401 d'origine remonter
      }
    }

    if (!response.ok) {
      let message = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        // API error format: { error: { message } } or { message }
        if (errorData.error?.message) message = errorData.error.message;
        else if (errorData.message) message = errorData.message;
      } catch {}
      throw new Error(message);
    }

    const json = await response.json();
    // API wraps responses in { success, data, timestamp } — unwrap
    return json.data !== undefined ? json.data : json;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}

// ============================================================
// Generic REST helpers (get/post/patch/put/del/upload)
// Utilisés par les écrans challenge/friends/rewards/notifications/profile.
// Ils délèguent à fetchWithToken (auth + unwrap { success, data } gérés).
// ============================================================

export async function get<T = any>(endpoint: string): Promise<T> {
  return fetchWithToken(endpoint, { method: 'GET' }) as Promise<T>;
}

export async function post<T = any>(endpoint: string, body?: any): Promise<T> {
  return fetchWithToken(endpoint, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as Promise<T>;
}

export async function patch<T = any>(endpoint: string, body?: any): Promise<T> {
  return fetchWithToken(endpoint, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as Promise<T>;
}

export async function put<T = any>(endpoint: string, body?: any): Promise<T> {
  return fetchWithToken(endpoint, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as Promise<T>;
}

export async function del<T = any>(endpoint: string): Promise<T> {
  return fetchWithToken(endpoint, { method: 'DELETE' }) as Promise<T>;
}

// ── TURN / STUN (WebRTC multijoueur voix/vidéo) ─────────────────────────────
export interface IceServer { urls: string | string[]; username?: string; credential?: string }
export interface TurnCredentials { iceServers: IceServer[]; ttlExpiresAt: number }

/**
 * Récupère les credentials TURN tournants (HMAC, exp 24h) depuis l'API.
 * À passer directement à `new RTCPeerConnection({ iceServers })`.
 * Fallback : STUN public Google si l'endpoint échoue (NAT simple OK).
 */
export async function getTurnCredentials(): Promise<TurnCredentials> {
  try {
    return await get<TurnCredentials>('/api/turn-creds');
  } catch {
    return {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      ttlExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }
}

/**
 * Upload multipart/form-data (ex: avatar). Ne PAS forcer Content-Type :
 * fetch le règle automatiquement avec le boundary multipart.
 */
export async function upload<T = any>(endpoint: string, form: FormData): Promise<T> {
  const url = `${getApiUrl()}${endpoint}`;
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  try {
    const response = await fetch(url, { method: 'POST', headers, body: form as any });
    if (!response.ok) {
      let message = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) message = errorData.error.message;
        else if (errorData.message) message = errorData.message;
      } catch {}
      throw new Error(message);
    }
    const json = await response.json();
    return (json.data !== undefined ? json.data : json) as T;
  } catch (error) {
    console.error(`API upload failed: ${endpoint}`, error);
    throw error;
  }
}

// Authentication APIs
export async function login(email: string, password: string, options?: { gameType?: string }) {
  try {
    const data = await fetchWithToken('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, gameType: options?.gameType }),
    });

    if (data.accessToken) {
      authToken = data.accessToken;
    }
    if (data.refreshToken) {
      refreshToken = data.refreshToken;
    }

    return data;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

/**
 * Google Sign-In : envoie l'id_token Google au backend (/auth/google),
 * qui le verifie via Google tokeninfo et retourne les tokens JWT SallyCards.
 */
export async function loginWithGoogle(
  idToken: string,
  options?: { gameType?: string }
) {
  try {
    const data = await fetchWithToken('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, gameType: options?.gameType ?? 'belote' }),
    });
    if (data.accessToken) authToken = data.accessToken;
    if (data.refreshToken) refreshToken = data.refreshToken;
    return data;
  } catch (error) {
    console.error('Google login failed:', error);
    throw error;
  }
}

export async function register(
  email: string,
  username: string,
  password: string
) {
  try {
    const data = await fetchWithToken('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });

    if (data.accessToken) {
      authToken = data.accessToken;
    }
    if (data.refreshToken) {
      refreshToken = data.refreshToken;
    }

    return data;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

export async function getMe(): Promise<User> {
  try {
    const data = await fetchWithToken('/users/me', {
      method: 'GET',
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
}

export async function refreshTokenAsync(): Promise<{ token: string }> {
  try {
    const data = await fetchWithToken('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (data.accessToken) {
      authToken = data.accessToken;
    }
    if (data.refreshToken) {
      refreshToken = data.refreshToken;
    }

    return data;
  } catch (error) {
    console.error('Token refresh failed:', error);
    authToken = null;
    refreshToken = null;
    throw error;
  }
}

export async function logout() {
  authToken = null;
  refreshToken = null;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null, refresh?: string | null) {
  authToken = token;
  if (refresh !== undefined) {
    refreshToken = refresh;
  }
}

// Guest session
export async function createGuestSession(): Promise<{ token: string }> {
  try {
    const data = await fetchWithToken('/auth/guest', {
      method: 'POST',
    });

    if (data.accessToken) {
      authToken = data.accessToken;
    }
    if (data.refreshToken) {
      refreshToken = data.refreshToken;
    }

    return data;
  } catch (error) {
    console.error('Failed to create guest session:', error);
    throw error;
  }
}

// Players API — fetch players for a specific game
export async function getPlayers(gameType: string): Promise<any[]> {
  try {
    const data = await fetchWithToken(`/users/by-game/${gameType}`, { method: 'GET' });
    return Array.isArray(data) ? data : (data.users || []);
  } catch (error) {
    console.error(`Failed to fetch players for ${gameType}:`, error);
    return [];
  }
}

// Leaderboard APIs
export async function getLeaderboard(
  gameType: string,
  filter: 'season' | 'weekly' | 'allTime' = 'season',
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  try {
    const data = await fetchWithToken(
      `/leaderboards/${gameType}?filter=${filter}&limit=${limit}`,
      { method: 'GET' }
    );
    return data.entries || [];
  } catch (error) {
    console.error(`Failed to fetch leaderboard for ${gameType}:`, error);
    return [];
  }
}

export async function getMyRank(
  gameType: string,
  filter: 'season' | 'weekly' | 'allTime' = 'season'
): Promise<{ rank: number; elo: number; percentile: number }> {
  try {
    const data = await fetchWithToken(
      `/leaderboards/${gameType}/my-rank?filter=${filter}`,
      { method: 'GET' }
    );
    return data;
  } catch (error) {
    console.error(`Failed to fetch rank for ${gameType}:`, error);
    return { rank: 0, elo: 0, percentile: 0 };
  }
}

// Room APIs
export async function createRoom(
  gameType: string,
  config: {
    isPrivate?: boolean;
    maxPlayers?: number;
    botDifficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  } = {}
): Promise<Room> {
  try {
    const data = await fetchWithToken('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        gameType,
        ...config,
      }),
    });
    return data;
  } catch (error) {
    console.error('Failed to create room:', error);
    throw error;
  }
}

export async function listRooms(gameType: string): Promise<Room[]> {
  try {
    const data = await fetchWithToken(`/rooms?gameType=${gameType}`, {
      method: 'GET',
    });
    return data.rooms || [];
  } catch (error) {
    console.error('Failed to list rooms:', error);
    return [];
  }
}

export async function joinRoom(code: string): Promise<Room> {
  try {
    const data = await fetchWithToken(`/rooms/${code}/join`, {
      method: 'POST',
    });
    return data;
  } catch (error) {
    console.error('Failed to join room:', error);
    throw error;
  }
}

export async function leaveRoom(code: string): Promise<void> {
  try {
    await fetchWithToken(`/rooms/${code}/leave`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to leave room:', error);
    throw error;
  }
}

// Bot APIs
export async function listBots(): Promise<Bot[]> {
  try {
    const data = await fetchWithToken('/bots', {
      method: 'GET',
    });
    return data.bots || [];
  } catch (error) {
    console.error('Failed to fetch bots:', error);
    return [];
  }
}

// Update profile
export async function updateProfile(updates: Partial<User>): Promise<User> {
  try {
    const data = await fetchWithToken('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data;
  } catch (error) {
    console.error('Failed to update profile:', error);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Extended Leaderboard (world / country / city)
// ──────────────────────────────────────────────

export async function getLeaderboardScoped(
  gameType: string,
  filter: 'season' | 'weekly' | 'allTime' = 'season',
  scope: 'world' | 'country' | 'city' = 'world',
  limit = 50,
): Promise<{ entries: LeaderboardEntry[]; scope: string; filter: string; total: number }> {
  try {
    const data = await fetchWithToken(
      `/leaderboards/${gameType}?filter=${filter}&scope=${scope}&limit=${limit}`,
      { method: 'GET' },
    );
    return {
      entries: data.entries || [],
      scope: data.scope || scope,
      filter: data.filter || filter,
      total: data.total || 0,
    };
  } catch (e) {
    console.error(`getLeaderboardScoped(${gameType}, ${scope}) failed`, e);
    return { entries: [], scope, filter, total: 0 };
  }
}

// ──────────────────────────────────────────────
// Rooms (create / list / join / ready / start)
// ──────────────────────────────────────────────

export interface RoomFull {
  code: string;
  hostId: string;
  gameType: string;
  status: 'waiting' | 'starting' | 'in_progress' | 'finished';
  mode: 'public' | 'private' | 'ranked';
  maxPlayers: number;
  minPlayers: number;
  playersCount: number;
  players: Array<{ userId: string; username: string; isReady: boolean; isHost?: boolean; joinedAt: string }>;
  config: Record<string, any>;
  shareUrl: string;
  createdAt: string;
}

export async function createRoomFull(
  gameType: string,
  opts: { isPrivate?: boolean; maxPlayers?: number; minPlayers?: number; stake?: number } = {},
): Promise<RoomFull> {
  return fetchWithToken('/rooms', {
    method: 'POST',
    body: JSON.stringify({ gameType, ...opts }),
  });
}

export async function listRoomsFull(gameType?: string): Promise<{ rooms: RoomFull[]; total: number }> {
  const q = gameType ? `?gameType=${gameType}` : '';
  return fetchWithToken(`/rooms${q}`, { method: 'GET' });
}

export async function findRoomByCode(code: string): Promise<RoomFull> {
  return fetchWithToken(`/rooms/${code.toUpperCase()}`, { method: 'GET' });
}

export async function joinRoomFull(code: string): Promise<RoomFull> {
  return fetchWithToken(`/rooms/${code.toUpperCase()}/join`, { method: 'POST' });
}

export async function leaveRoomFull(code: string): Promise<RoomFull> {
  return fetchWithToken(`/rooms/${code.toUpperCase()}/leave`, { method: 'POST' });
}

export async function setReady(code: string, isReady: boolean): Promise<RoomFull> {
  return fetchWithToken(`/rooms/${code.toUpperCase()}/ready`, {
    method: 'POST',
    body: JSON.stringify({ isReady }),
  });
}

export async function startGame(code: string): Promise<RoomFull> {
  return fetchWithToken(`/rooms/${code.toUpperCase()}/start`, { method: 'POST' });
}

/**
 * Simulation mode — creates a room pre-filled with `userCount` random
 * users from the DB as "bots" that will auto-play once the game starts.
 */
export async function simulateRoom(gameType: string, userCount: number): Promise<RoomFull> {
  return fetchWithToken('/rooms/simulate', {
    method: 'POST',
    body: JSON.stringify({ gameType, userCount }),
  });
}

// ──────────────────────────────────────────────
// Bots (local vs-bot mode)
// ──────────────────────────────────────────────

export async function botMove(
  gameType: string,
  state: { hand: string[]; table?: string[]; history?: any[]; lockedCards?: string[]; rules?: string },
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium',
): Promise<{ card: string | null; action: string; confidence: number; reasoning?: string }> {
  return fetchWithToken(`/bots/${gameType}/move`, {
    method: 'POST',
    body: JSON.stringify({ difficulty, state }),
  });
}

// ──────────────────────────────────────────────
// Shop
// ──────────────────────────────────────────────

export interface ShopPackage {
  productId: string;
  name: string;
  coins: number;
  bonus: number;
  priceEur: number;
  priceUsd: number;
  icon: string;
  gradient: [string, string];
  sortOrder: number;
  popular?: boolean;
  bestValue?: boolean;
  subscription?: boolean;
  durationDays?: number;
}

export async function getShopPackages(): Promise<ShopPackage[]> {
  try {
    const data = await fetchWithToken('/shop/packages', { method: 'GET' });
    return Array.isArray(data) ? data : data.packages || [];
  } catch (e) {
    console.error('getShopPackages failed', e);
    return [];
  }
}

export async function confirmPurchase(
  gameType: string,
  productId: string,
  purchaseId: string,
  platform: 'android' | 'ios',
): Promise<{ amount: number; newBalance: number; pkg: any }> {
  return fetchWithToken('/shop/purchase/confirm', {
    method: 'POST',
    body: JSON.stringify({ gameType, productId, purchaseId, platform }),
  });
}

// ──────────────────────────────────────────────
// Daily Challenge
// ──────────────────────────────────────────────

export async function getDailyChallenge(gameType: string): Promise<any> {
  try {
    return await fetchWithToken(`/challenges/daily/${gameType}`, { method: 'GET' });
  } catch (e: any) {
    // 404 = backend hasn't created today's challenge yet; return a local
    // default so the UI still renders a valid daily card.
    const isMissing = /not found|no challenge/i.test(e?.message || '');
    if (isMissing) {
      return {
        gameType,
        title: 'Défi du jour',
        description: 'Gagne 3 parties consécutives pour empocher le bonus',
        rewardCoins: 50,
        rewardXp: 100,
        active: true,
        participants: [],
        date: new Date().toISOString(),
        fallback: true,
      };
    }
    console.error('getDailyChallenge failed', e);
    return null;
  }
}

export async function joinDailyChallenge(gameType: string): Promise<RoomFull> {
  return fetchWithToken(`/challenges/daily/${gameType}/matchmake`, { method: 'POST' });
}

// ──────────────────────────────────────────────
// Games (stat sync at end of match)
// ──────────────────────────────────────────────

export async function completeGame(result: {
  gameType: string;
  gameId?: string;
  durationMs?: number;
  mode?: string;
  players: Array<{ userId: string; username?: string; placement: number; score?: number; isBot?: boolean }>;
}): Promise<{ updated: Array<{ userId: string; eloDelta: number; won: boolean }> }> {
  return fetchWithToken('/games/complete', {
    method: 'POST',
    body: JSON.stringify(result),
  });
}

/** Persist a SOLO game (best-effort, 3 fallbacks). */
export async function saveSoloGame(input: {
  gameType: string;
  variant: string;
  score: number;
  moves: number;
  durationMs: number;
  won: boolean;
}): Promise<{ persisted: boolean; via: 'games/save' | 'leaderboards' | 'games/complete' | 'none' }> {
  try {
    await fetchWithToken('/games/save', { method: 'POST', body: JSON.stringify(input) });
    return { persisted: true, via: 'games/save' };
  } catch {
    try {
      await fetchWithToken(`/leaderboards/${input.gameType}/submit`, {
        method: 'POST',
        body: JSON.stringify({ score: input.score, variant: input.variant, moves: input.moves, durationMs: input.durationMs, won: input.won }),
      });
      return { persisted: true, via: 'leaderboards' };
    } catch {
      try {
        const me = authToken ? await getMe().catch(() => null) : null;
        if (me) {
          await completeGame({
            gameType: input.gameType, mode: input.variant, durationMs: input.durationMs,
            players: [{ userId: (me as any).id ?? (me as any)._id, username: me.username, placement: input.won ? 1 : 2, score: input.score, isBot: false }],
          });
          return { persisted: true, via: 'games/complete' };
        }
      } catch (e) { console.error('saveSoloGame: all 3 endpoints failed', e); }
      return { persisted: false, via: 'none' };
    }
  }
}

// ──────────────────────────────────────────────

export interface HkimGeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface Hkim {
  _id: string;
  userId: string;
  name: string;
  order: number;
  start: HkimGeoPoint;
  end: HkimGeoPoint;
  distanceMeters: number;
  /** Polyline encodée (Google) de l'itinéraire routier réel. */
  routePolyline?: string;
  maxDate: string;
  status: 'pending' | 'done';
  completedAt?: string;
}

/** Jeu courant → collection Mongo dédiée hkim_<jeu> côté backend. */
export const HKIM_GAME = 'belote';

/** Liste les hkim du user (auto-seed 10 côté backend si vide + coords fournies). */
export async function getHkims(lat?: number, lng?: number): Promise<Hkim[]> {
  const q =
    lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
  const data = await fetchWithToken(`/hkim/${HKIM_GAME}${q}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Régénère 10 hkim autour de (lat,lng). */
export async function regenerateHkims(lat: number, lng: number): Promise<Hkim[]> {
  const data = await fetchWithToken(`/hkim/${HKIM_GAME}/generate`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
  return Array.isArray(data) ? data : [];
}

/** Marque un hkim comme effectué. */
export async function completeHkim(id: string): Promise<Hkim> {
  return fetchWithToken(`/hkim/${HKIM_GAME}/${id}/complete`, { method: 'POST' });
}

export async function getHkimSummary(): Promise<{
  total: number;
  done: number;
  pending: number;
  items: Hkim[];
}> {
  return fetchWithToken(`/hkim/${HKIM_GAME}/summary`, { method: 'GET' });
}

export interface HkimComment {
  username: string;
  text: string;
  createdAt: string;
}

export interface HkimFeedItem {
  hkimId: string;
  userId: string;
  username: string;
  name: string;
  from: string;
  to: string;
  start?: HkimGeoPoint;
  end?: HkimGeoPoint;
  distanceMeters: number;
  completedAt: string;
  comments: HkimComment[];
}

/** Seed 10 hkim "historique" pour le user + autres users (fil). */
export async function seedHkimHistory(
  lat: number,
  lng: number,
): Promise<{ mine: number; others: number }> {
  return fetchWithToken(`/hkim/${HKIM_GAME}/seed-history`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}

/** Fil d'actualité : hkim effectués par tous les users. */
export async function getHkimFeed(limit = 30): Promise<HkimFeedItem[]> {
  const data = await fetchWithToken(`/hkim/${HKIM_GAME}/feed?limit=${limit}`, {
    method: 'GET',
  });
  return Array.isArray(data) ? data : [];
}

export async function getHkimComments(id: string): Promise<HkimComment[]> {
  const data = await fetchWithToken(`/hkim/${HKIM_GAME}/${id}/comments`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

export async function addHkimComment(
  id: string,
  text: string,
): Promise<HkimComment[]> {
  const data = await fetchWithToken(`/hkim/${HKIM_GAME}/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return Array.isArray(data) ? data : [];
}

