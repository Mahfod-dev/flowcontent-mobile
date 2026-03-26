import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    apiService.clearToken();
    socketService.disconnect();
    setUser(null);
  }, []);

  // Global 401 handler — any API call that returns 401 triggers auto-logout
  useEffect(() => {
    apiService.setOnTokenExpired(logout);
  }, [logout]);

  // Restore session on app start — non-blocking, no API call to validate
  useEffect(() => {
    apiService.getToken().then((token) => {
      if (token) {
        socketService.connect(token);
        setUser({ id: '', email: '', token });
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
    await apiService.saveToken(access_token);
    socketService.connect(access_token);
    setUser({ ...userData, token: access_token });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
