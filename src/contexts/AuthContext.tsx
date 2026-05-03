import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithGoogleCode: (accessToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  loginWithGoogleCode: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pushTokenRef = useRef<string | null>(null);

  const logout = useCallback(async () => {
    // Fire-and-forget: unregister push token
    const pushToken = pushTokenRef.current;
    if (pushToken) {
      apiService.getToken().then((t) => {
        if (t) apiService.unregisterDeviceToken(t, pushToken).catch(() => {});
      });
      pushTokenRef.current = null;
      AsyncStorage.removeItem('fc_expo_push_token').catch(() => {});
    }
    // Revoke refresh token server-side before clearing
    try {
      const rt = await SecureStore.getItemAsync('fc_refresh_token');
      if (rt) apiService.revokeRefreshToken(rt);
    } catch {}
    // Disconnect socket BEFORE clearing token (socket may need token for clean shutdown)
    socketService.disconnect();
    apiService.clearToken();
    setUser(null);
  }, []);

  // Global 401 handler — any API call that returns 401 triggers auto-logout
  useEffect(() => {
    apiService.setOnTokenExpired(logout);
  }, [logout]);

  // Token refresh callback — update user state + reconnect socket with new JWT
  useEffect(() => {
    apiService.setOnTokenRefreshed((newToken: string) => {
      setUser((prev) => prev ? { ...prev, token: newToken } : prev);
      socketService.disconnect();
      socketService.connect(newToken);
    });
    return () => apiService.setOnTokenRefreshed(null);
  }, []);

  // Restore session on app start — validate token with /api/auth/me
  useEffect(() => {
    apiService.getToken().then(async (token) => {
      if (token) {
        try {
          const profile = await apiService.getProfile(token);
          if (profile) {
            socketService.connect(token);
            setUser({
              id: profile.id || '',
              email: profile.email || '',
              name: profile.name,
              token,
            });
            // Restore push token ref for logout (non-critical, don't let it break auth)
            try {
              const savedPush = await AsyncStorage.getItem('fc_expo_push_token');
              if (savedPush) pushTokenRef.current = savedPush;
            } catch {}

          } else {
            await apiService.clearToken();
          }
        } catch {
          await apiService.clearToken();
        }
      }
      setIsLoading(false);
    });
  }, []);

  // Session timeout — auto-logout after 30 min in background
  const backgroundTimestamp = useRef<number | null>(null);
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // Reconnect socket + re-join session when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundTimestamp.current = Date.now();
      } else if (state === 'active' && user?.token) {
        // Check session timeout
        if (backgroundTimestamp.current && Date.now() - backgroundTimestamp.current > SESSION_TIMEOUT_MS) {
          backgroundTimestamp.current = null;
          Alert.alert('Session expirée', 'Vous avez été déconnecté après 30 minutes d\'inactivité.', [
            { text: 'OK', onPress: logout },
          ]);
          return;
        }
        backgroundTimestamp.current = null;

        const wasDisconnected = !socketService.isConnected();
        if (wasDisconnected) {
          socketService.connect(user.token);
        }
        // Always re-join current session room (may have been lost during background)
        socketService.rejoinCurrentSession();
      }
    });
    return () => subscription.remove();
  }, [user?.token, logout]);

  const login = async (email: string, password: string) => {
    const data = await apiService.login(email, password);
    const { access_token, user: userData, refresh_token } = data;
    if (!access_token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(access_token);
    if (refresh_token) await apiService.saveRefreshToken(refresh_token);
    socketService.connect(access_token);
    setUser({ ...userData, token: access_token });
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiService.register(name, email, password);
    const { access_token, user: userData, refresh_token } = data;
    if (!access_token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(access_token);
    if (refresh_token) await apiService.saveRefreshToken(refresh_token);
    socketService.connect(access_token);
    setUser({ ...userData, token: access_token });
  };

  const loginWithGoogle = async (idToken: string) => {
    const data = await apiService.loginWithGoogle(idToken);
    const token = data.token || data.access_token;
    if (!token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(token);
    if (data.refresh_token) await apiService.saveRefreshToken(data.refresh_token);
    socketService.connect(token);
    const u = data.user || {};
    setUser({ id: u.id || '', email: u.email || '', name: u.name, token });
  };

  const loginWithGoogleCode = async (accessToken: string) => {
    const data = await apiService.loginWithGoogleAccessToken(accessToken);
    const token = data.token || data.access_token;
    if (!token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(token);
    if (data.refresh_token) await apiService.saveRefreshToken(data.refresh_token);
    socketService.connect(token);
    const u = data.user || {};
    setUser({ id: u.id || '', email: u.email || '', name: u.name, token });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithGoogle, loginWithGoogleCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
