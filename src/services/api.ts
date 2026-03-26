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
