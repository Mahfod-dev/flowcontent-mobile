import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pushTokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    // Fire-and-forget: unregister push token
    const pushToken = pushTokenRef.current;
    if (pushToken) {
      apiService.getToken().then((t) => {
        if (t) apiService.unregisterDeviceToken(t, pushToken).catch(() => {});
      });
      pushTokenRef.current = null;
      AsyncStorage.removeItem('fc_expo_push_token').catch(() => {});
    }
    apiService.clearToken();
    socketService.disconnect();
    setUser(null);
  }, []);

  // Global 401 handler — any API call that returns 401 triggers auto-logout
  useEffect(() => {
    apiService.setOnTokenExpired(logout);
  }, [logout]);

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

  // Reconnect socket when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.token) {
        if (!socketService.isConnected()) {
          socketService.connect(user.token);
        }
      }
    });
    return () => subscription.remove();
  }, [user?.token]);

  const login = async (email: string, password: string) => {
    const data = await apiService.login(email, password);
    const { access_token, user: userData } = data;
    if (!access_token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(access_token);
    socketService.connect(access_token);
    setUser({ ...userData, token: access_token });
  };

  const loginWithGoogle = async (idToken: string) => {
    const data = await apiService.loginWithGoogle(idToken);
    const token = data.token || data.access_token;
    if (!token) throw new Error('Pas de token dans la réponse');
    await apiService.saveToken(token);
    socketService.connect(token);
    const u = data.user || {};
    setUser({ id: u.id || '', email: u.email || '', name: u.name, token });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
