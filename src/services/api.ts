import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Credits, CreditPack, CreditTransaction, CurrentSubscription, DashboardData, MediaFile, NangoConnection, NangoProvider, Session, SubscriptionPlan } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

const DEFAULT_TIMEOUT_MS = 30_000; // 30s default timeout for all API calls

/** Fetch with AbortController timeout — prevents hanging requests */
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Global 401 handler — triggers auto-logout from any API call
let _onTokenExpired: (() => void) | null = null;

// Callback to update token in AuthContext after refresh
let _onTokenRefreshed: ((token: string) => void) | null = null;

// Active site domain — set by site switcher, sent as X-Site-Domain header
let _activeSiteDomain: string | null = null;

// Prevent concurrent refresh attempts
let _refreshPromise: Promise<string | null> | null = null;
// Flag to prevent stale refresh callbacks after logout
let _loggedOut = false;

async function tryRefreshToken(): Promise<string | null> {
  if (_loggedOut) return null;
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('fc_refresh_token');
      if (!refreshToken || _loggedOut) return null;

      const res = await fetchWithTimeout(`${API_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok || _loggedOut) return null;
      const data = await safeJson(res);
      if (!data?.access_token || !data?.refresh_token || _loggedOut) return null;

      // Persist new tokens
      await SecureStore.setItemAsync('fc_token', data.access_token);
      await SecureStore.setItemAsync('fc_refresh_token', data.refresh_token);

      // Notify AuthContext to update user.token + reconnect socket
      if (!_loggedOut && _onTokenRefreshed) _onTokenRefreshed(data.access_token);

      return _loggedOut ? null : data.access_token;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

async function authFetch(url: string, token: string, init?: RequestInit, critical = true): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
    Authorization: `Bearer ${token}`,
  };
  if (_activeSiteDomain) {
    headers['X-Site-Domain'] = _activeSiteDomain;
  }
  const res = await fetchWithTimeout(url, { ...init, headers });

  // Auto-refresh on 401
  if (res.status === 401 && critical) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      // Retry the original request with the new token
      const retryHeaders: Record<string, string> = {
        ...(init?.headers as Record<string, string> || {}),
        Authorization: `Bearer ${newToken}`,
      };
      if (_activeSiteDomain) {
        retryHeaders['X-Site-Domain'] = _activeSiteDomain;
      }
      return fetchWithTimeout(url, { ...init, headers: retryHeaders });
    }
    // Refresh failed — force logout
    if (_onTokenExpired) _onTokenExpired();
  }

  return res;
}

export const apiService = {
  setOnTokenExpired(cb: () => void) { _onTokenExpired = cb; },
  setOnTokenRefreshed(cb: ((token: string) => void) | null) { _onTokenRefreshed = cb; },

  setActiveSiteDomain(domain: string | null) { _activeSiteDomain = domain; },
  getActiveSiteDomain(): string | null { return _activeSiteDomain; },

  async loginWithGoogle(idToken: string) {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/google/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken }),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Erreur serveur (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || 'Connexion Google échouée');
    }
    return data;
  },

  async loginWithGoogleAccessToken(accessToken: string) {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/google/login/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Erreur serveur (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || 'Connexion Google échouée');
    }
    return data;
  },

  async login(email: string, password: string) {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Erreur serveur (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || 'Email ou mot de passe incorrect');
    }
    return data;
  },

  async getOrCreateSession(token: string): Promise<{ sessionId: string }> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errData = await safeJson(res) ?? {};
      const msg = errData?.error?.message || errData?.message || `Erreur ${res.status}`;
      throw new Error(`Impossible de créer une session: ${msg}`);
    }
    const data = await safeJson(res);
    return { sessionId: data?.conversation?.id || data?.sessionId || data?.id };
  },

  async getSessions(token: string): Promise<Session[]> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions`, token);
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const conversations = data.conversations ?? data ?? [];
    return conversations.map((c: any) => ({
      id: c.id,
      title: c.title || c.name || c.subject || '',
      last_message_at: c.last_message_at || c.lastMessageAt || c.updated_at || c.updatedAt || c.created_at || c.createdAt,
      created_at: c.created_at || c.createdAt,
    })).sort(
      (a: Session, b: Session) =>
        new Date(b.last_message_at ?? b.created_at ?? 0).getTime() -
        new Date(a.last_message_at ?? a.created_at ?? 0).getTime()
    );
  },

  async deleteSession(token: string, sessionId: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions/${sessionId}`, token, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async getSessionMessages(token: string, sessionId: string) {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions/${sessionId}`, token);
    if (!res.ok) return [];
    const data = await safeJson(res);
    return data?.messages ?? data?.conversation?.messages ?? [];
  },

  async renameSession(token: string, sessionId: string, title: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions/${sessionId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  },

  async getCredits(token: string): Promise<Credits | null> {
    const res = await authFetch(`${API_URL}/api/credits`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    const c = data.data ?? data;
    return {
      total_available: c.total ?? c.balance ?? c.total_available ?? 0,
      free_credits_remaining: c.free_balance ?? c.free_credits_remaining ?? 0,
      plan: c.plan ?? 'free',
    };
  },

  async uploadFile(token: string, fileUri: string, fileName: string, mimeType: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const doUpload = async (t: string) => {
      const headers: Record<string, string> = { Authorization: `Bearer ${t}` };
      if (_activeSiteDomain) headers['X-Site-Domain'] = _activeSiteDomain;
      return fetchWithTimeout(`${API_URL}/api/fc-agent/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      }, 120_000); // 2min timeout for file uploads
    };

    let res = await doUpload(token);
    if (res.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        res = await doUpload(newToken);
      } else {
        if (_onTokenExpired) _onTokenExpired();
      }
    }
    if (!res.ok) {
      const err = await safeJson(res) ?? {};
      throw new Error(err.message || `Upload failed (${res.status})`);
    }
    return safeJson(res);
  },

  // Site Domains
  async getSiteDomains(token: string): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/site-domains`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.sites ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  // Notifications
  async getNotificationBadge(token: string): Promise<{ unread: number; urgent: number }> {
    const res = await authFetch(`${API_URL}/api/notifications/badge`, token, undefined, false);
    if (!res.ok) return { unread: 0, urgent: 0 };
    const data = await safeJson(res);
    const badge = data?.data ?? data;
    return { unread: badge?.unread ?? 0, urgent: badge?.urgent ?? 0 };
  },

  async getNotifications(token: string, limit = 50): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/notifications?limit=${limit}`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.notifications ?? data;
    return Array.isArray(list) ? list : [];
  },

  async markNotificationRead(token: string, id: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/${id}/read`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, false);
    return res.ok;
  },

  async markAllNotificationsRead(token: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/read-all`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, false);
    return res.ok;
  },

  // User Profile
  async getProfile(token: string): Promise<any> {
    const res = await authFetch(`${API_URL}/api/auth/me`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    return data.user ?? data;
  },

  async updateProfile(token: string, profile: Record<string, any>): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/settings/profile`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }, false);
    return res.ok;
  },

  // Integrations
  async getMyIntegrations(token: string): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/integrations/my`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.integrations ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  // Dashboard
  async getDashboard(token: string): Promise<DashboardData | null> {
    const res = await authFetch(`${API_URL}/api/dashboard`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    return data.data ?? data;
  },

  async getDashboardMetrics(token: string): Promise<any> {
    const res = await authFetch(`${API_URL}/api/dashboard/metrics`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    return data?.data ?? data;
  },


  async getUrgentNotifications(token: string): Promise<{ total: number; data: any[] }> {
    const res = await authFetch(`${API_URL}/api/notifications/urgent`, token, undefined, false);
    if (!res.ok) return { total: 0, data: [] };
    const data = await safeJson(res);
    if (!data) return { total: 0, data: [] };
    const list = data.data ?? data.notifications ?? data ?? [];
    const arr = Array.isArray(list) ? list : [];
    return { total: data.total ?? arr.length, data: arr };
  },

  async getDailyTasks(token: string): Promise<any> {
    const res = await authFetch(`${API_URL}/api/daily-tasks`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    return data?.data ?? data;
  },

  // Nango OAuth
  async getNangoConnections(token: string): Promise<NangoConnection[]> {
    const res = await authFetch(`${API_URL}/api/integrations/nango/connections`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.connections ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  async deleteNangoConnection(token: string, provider: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/integrations/nango/connections/${provider}`, token, {
      method: 'DELETE',
    }, false);
    return res.ok;
  },

  async getNangoProviders(token: string): Promise<NangoProvider[]> {
    const res = await authFetch(`${API_URL}/api/integrations/providers`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.providers ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  async initiateOAuth(token: string, provider: string): Promise<{ url: string } | null> {
    const res = await authFetch(`${API_URL}/api/integrations/oauth/initiate`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    }, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    const authUrl = data.data?.authUrl ?? data.authUrl ?? data.url;
    return authUrl ? { url: authUrl } : null;
  },

  // Subscription Plans
  async getSubscriptionPlans(token: string): Promise<SubscriptionPlan[]> {
    const res = await authFetch(`${API_URL}/api/credits/subscriptions/plans`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.plans ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  async getCurrentSubscription(token: string): Promise<CurrentSubscription | null> {
    const res = await authFetch(`${API_URL}/api/credits/subscriptions/current`, token, undefined, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    const sub = data.data ?? data.subscription ?? data;
    return {
      id: sub.id,
      plan: sub.plan ?? sub.name ?? 'free',
      status: sub.status ?? 'active',
      credits_remaining: sub.credits_remaining ?? sub.balance ?? 0,
      credits_total: sub.credits_total ?? sub.total ?? 0,
      current_period_end: sub.current_period_end ?? sub.reset_at,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    };
  },

  async subscribePlan(token: string, planId: string): Promise<{ url: string } | null> {
    const res = await authFetch(`${API_URL}/api/credits/subscriptions/subscribe`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    }, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    return { url: data.url ?? data.data?.url ?? '' };
  },

  async cancelSubscription(token: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/credits/subscriptions/cancel`, token, {
      method: 'POST',
    }, false);
    return res.ok;
  },

  async getStripePortal(token: string): Promise<{ url: string } | null> {
    const res = await authFetch(`${API_URL}/api/credits/subscriptions/portal`, token, {
      method: 'POST',
    }, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    return { url: data.url ?? data.data?.url ?? '' };
  },

  // Credit Packs
  async getCreditPacks(token: string): Promise<CreditPack[]> {
    const res = await authFetch(`${API_URL}/api/credits/packs`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.packs ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  async purchasePack(token: string, packId: string): Promise<{ url: string } | null> {
    const res = await authFetch(`${API_URL}/api/credits/purchase`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    }, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data) return null;
    return { url: data.url ?? data.data?.url ?? '' };
  },

  // Credit History
  async getCreditHistory(token: string): Promise<CreditTransaction[]> {
    const res = await authFetch(`${API_URL}/api/credits/history`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.history ?? data.transactions ?? data ?? [];
    return Array.isArray(list) ? list : [];
  },

  // Media Files (via backend proxy to Supabase Storage)
  async getMediaFiles(token: string): Promise<MediaFile[]> {
    const res = await authFetch(`${API_URL}/api/fc-agent/files`, token, undefined, false);
    if (!res.ok) return [];
    const data = await safeJson(res);
    if (!data) return [];
    const list = data.data ?? data.files ?? data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((f: any) => ({
      name: f.name ?? f.filename ?? '',
      path: f.path ?? f.storagePath ?? f.name ?? '',
      bucket: f.bucket ?? 'agent-files',
      size: f.size ?? f.metadata?.size ?? 0,
      mimeType: f.mimeType ?? f.mime_type ?? f.metadata?.mimetype ?? 'application/octet-stream',
      created_at: f.created_at ?? f.createdAt ?? f.updated_at ?? '',
      url: f.url ?? f.publicUrl,
    }));
  },

  async deleteMediaFile(token: string, path: string, bucket = 'agent-files'): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/fc-agent/files`, token, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, bucket }),
    }, false);
    return res.ok;
  },

  async getMediaFileUrl(token: string, path: string, bucket = 'agent-files'): Promise<string | null> {
    const res = await authFetch(`${API_URL}/api/fc-agent/files/url`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, bucket }),
    }, false);
    if (!res.ok) return null;
    const data = await safeJson(res);
    return data?.url ?? data?.data?.url ?? null;
  },

  // Push notification device token
  async registerDeviceToken(token: string, expoPushToken: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/register-device`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expoPushToken, platform: Platform.OS }),
    }, false);
    return res.ok;
  },

  async unregisterDeviceToken(token: string, expoPushToken: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/register-device`, token, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expoPushToken }),
    }, false);
    return res.ok;
  },

  async submitFeedback(token: string, sessionId: string, messageIndex: number, rating: 'up' | 'down'): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions/${sessionId}/feedback`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_index: messageIndex, rating }),
    });
    return res.ok;
  },

  async saveToken(token: string) {
    _loggedOut = false; // Reset logout flag on new login
    await SecureStore.setItemAsync('fc_token', token);
    // Clean up legacy plaintext token from AsyncStorage (migration)
    AsyncStorage.removeItem('fc_token').catch(() => {});
  },

  async getToken(): Promise<string | null> {
    // Try secure store first, fallback to AsyncStorage for migration
    const secure = await SecureStore.getItemAsync('fc_token');
    if (secure) return secure;
    const legacy = await AsyncStorage.getItem('fc_token');
    if (legacy) {
      // Migrate to secure store
      await SecureStore.setItemAsync('fc_token', legacy);
      AsyncStorage.removeItem('fc_token').catch(() => {});
      return legacy;
    }
    return null;
  },

  async saveRefreshToken(refreshToken: string) {
    await SecureStore.setItemAsync('fc_refresh_token', refreshToken);
  },

  async clearToken() {
    _loggedOut = true; // Prevent stale refresh callbacks
    await SecureStore.deleteItemAsync('fc_token');
    await SecureStore.deleteItemAsync('fc_refresh_token');
    AsyncStorage.removeItem('fc_token').catch(() => {});
  },

  async revokeRefreshToken(refreshToken: string) {
    try {
      await fetchWithTimeout(`${API_URL}/api/auth/revoke-refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {}
  },
};
