import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

// Global 401 handler — triggers auto-logout from any API call
let _onTokenExpired: (() => void) | null = null;

async function authFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && _onTokenExpired) {
    _onTokenExpired();
  }
  return res;
}

export const apiService = {
  setOnTokenExpired(cb: () => void) { _onTokenExpired = cb; },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || 'Email ou mot de passe incorrect');
    }
    return data;
  },

  async getOrCreateSession(token: string): Promise<{ sessionId: string }> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nouvelle conversation' }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || errData?.message || `Erreur ${res.status}`;
      throw new Error(`Impossible de créer une session: ${msg}`);
    }
    const data = await res.json();
    return { sessionId: data.conversation?.id || data.sessionId || data.id };
  },

  async getSessions(token: string): Promise<Session[]> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions`, token);
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (!res.ok) return [];
    const data = await res.json();
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
    const data = await res.json();
    return data.messages ?? data.conversation?.messages ?? [];
  },

  async renameSession(token: string, sessionId: string, title: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/fc-agent/sessions/${sessionId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  },

  async getCredits(token: string): Promise<{ balance: number; free: number } | null> {
    const res = await authFetch(`${API_URL}/api/fc-agent/credits`, token);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      balance: data.credits?.total_available ?? 0,
      free: data.credits?.free_credits_remaining ?? 0,
    };
  },

  async uploadFile(token: string, fileUri: string, fileName: string, mimeType: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    const res = await fetch(`${API_URL}/api/fc-agent/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401 && _onTokenExpired) _onTokenExpired();
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Upload failed (${res.status})`);
    }
    return res.json();
  },

  // Site Domains
  async getSiteDomains(token: string): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/site-domains`, token);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sites ?? data ?? [];
  },

  // Notifications
  async getNotificationBadge(token: string): Promise<{ unread: number; urgent: number }> {
    const res = await authFetch(`${API_URL}/api/notifications/badge`, token);
    if (!res.ok) return { unread: 0, urgent: 0 };
    return res.json();
  },

  async getNotifications(token: string, limit = 50): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/notifications?limit=${limit}`, token);
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications ?? data ?? [];
  },

  async markNotificationRead(token: string, id: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/${id}/read`, token, { method: 'POST' });
    return res.ok;
  },

  async markAllNotificationsRead(token: string): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/notifications/read-all`, token, { method: 'POST' });
    return res.ok;
  },

  // User Profile
  async getProfile(token: string): Promise<any> {
    const res = await authFetch(`${API_URL}/api/users/profile`, token);
    if (!res.ok) return null;
    return res.json();
  },

  async updateProfile(token: string, profile: Record<string, any>): Promise<boolean> {
    const res = await authFetch(`${API_URL}/api/users/profile`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    return res.ok;
  },

  // Integrations
  async getMyIntegrations(token: string): Promise<any[]> {
    const res = await authFetch(`${API_URL}/api/integrations/my`, token);
    if (!res.ok) return [];
    const data = await res.json();
    return data.integrations ?? data ?? [];
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
    await AsyncStorage.setItem('fc_token', token);
  },

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('fc_token');
  },

  async clearToken() {
    await AsyncStorage.removeItem('fc_token');
  },
};
