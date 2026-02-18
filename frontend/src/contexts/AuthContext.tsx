import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall, AuthError, isAuthError } from '../api/client';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  language: string;
  first_name?: string;
  last_name?: string;
  profile_completed?: boolean;
  email_verified?: boolean;
  accepted_privacy?: boolean;
  accepted_terms?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithToken: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  handleAuthError: (error: any) => Promise<void>;
  updateUser: (u: Partial<User>) => void;
}

interface RegisterData {
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  password: string;
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('access_token');
      const storedRefresh = await AsyncStorage.getItem('refresh_token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setRefreshToken(storedRefresh);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuth = async (accessToken: string, refreshTk: string, userData: User) => {
    await AsyncStorage.setItem('access_token', accessToken);
    await AsyncStorage.setItem('refresh_token', refreshTk);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setToken(accessToken);
    setRefreshToken(refreshTk);
    setUser(userData);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    await saveAuth(res.access_token, res.refresh_token, res.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: data.dateOfBirth,
        address: data.address,
        city: data.city,
        country: data.country,
        postal_code: data.postalCode,
        password: data.password,
        accepted_privacy: data.acceptedPrivacy,
        accepted_terms: data.acceptedTerms,
      },
      skipAuth: true,
    });
    await saveAuth(res.access_token, res.refresh_token, res.user);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const loginWithToken = useCallback(async (accessToken: string, refreshToken: string, userData: User) => {
    // Save to BOTH AsyncStorage AND in-memory state (fixes Google OAuth routing issue)
    await AsyncStorage.setItem('access_token', accessToken);
    await AsyncStorage.setItem('refresh_token', refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setToken(accessToken);
    setRefreshToken(refreshToken);
    setUser(userData);
    console.log('[Auth] loginWithToken: state updated, user:', userData.email, 'profile_completed:', userData.profile_completed);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user', 'onboarding_seen']);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const currentRefreshToken = await AsyncStorage.getItem('refresh_token');
    if (!currentRefreshToken) {
      await logout();
      return false;
    }
    
    try {
      const res = await apiCall('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: currentRefreshToken },
        skipAuth: true,
      });
      await saveAuth(res.access_token, res.refresh_token, res.user);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [logout]);

  // Handler per gestire errori di autenticazione
  const handleAuthError = useCallback(async (error: any) => {
    if (isAuthError(error)) {
      await logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        isAuthenticated: !!token,
        login,
        register,
        loginWithToken,
        logout,
        refresh,
        handleAuthError,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
