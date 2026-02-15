/**
 * API Client centralizzato con auto-refresh token
 * - Se response 401 o "Token expired": chiama POST /api/auth/refresh
 * - Salva nuovi tokens in storage
 * - Riprova la request originale UNA volta
 * - Se refresh fallisce: clear storage + logout
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string | null;
  skipAuth?: boolean;
}

interface TokenRefreshResult {
  access_token: string;
  refresh_token: string;
  user: any;
}

// Flag per evitare refresh loop
let isRefreshing = false;
let refreshPromise: Promise<TokenRefreshResult | null> | null = null;

/**
 * Tenta il refresh del token
 */
async function refreshAccessToken(): Promise<TokenRefreshResult | null> {
  // Se già in corso, attendi il risultato
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const url = `${API_BASE}/api/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data: TokenRefreshResult = await response.json();

      // Salva nuovi token
      await AsyncStorage.setItem('access_token', data.access_token);
      await AsyncStorage.setItem('refresh_token', data.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));

      return data;
    } catch (error) {
      // Refresh fallito: clear storage
      await clearAuthStorage();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Pulisce lo storage auth
 */
async function clearAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
}

/**
 * Verifica se l'errore è relativo al token scaduto
 */
function isTokenExpiredError(status: number, errorBody: any): boolean {
  if (status === 401) return true;
  if (errorBody?.detail?.toLowerCase().includes('token expired')) return true;
  if (errorBody?.detail?.toLowerCase().includes('not authenticated')) return true;
  if (errorBody?.detail?.toLowerCase().includes('invalid token')) return true;
  return false;
}

/**
 * API Call principale con auto-refresh
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {},
  _retried = false
): Promise<T> {
  const { method = 'GET', body, token, skipAuth = false } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Usa token passato o prendi dallo storage
  let authToken = token;
  if (!authToken && !skipAuth) {
    authToken = await AsyncStorage.getItem('access_token');
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const config: RequestInit = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = `${API_BASE}/api${endpoint}`;
  
  try {
    const response = await fetch(url, config);

    // Parse response body
    let responseBody: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseBody = await response.json().catch(() => ({}));
    } else {
      responseBody = {};
    }

    // Check for token expired error
    if (!response.ok) {
      if (isTokenExpiredError(response.status, responseBody) && !_retried && !skipAuth) {
        // Tenta refresh
        const refreshResult = await refreshAccessToken();
        
        if (refreshResult) {
          // Riprova con nuovo token (una sola volta)
          return apiCall<T>(endpoint, { ...options, token: refreshResult.access_token }, true);
        } else {
          // Refresh fallito, throw per gestione logout
          throw new AuthError('Session expired. Please login again.');
        }
      }

      throw new Error(responseBody.detail || `HTTP ${response.status}`);
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error');
  }
}

/**
 * Error class per errori di autenticazione
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Helper per verificare se è un AuthError
 */
export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError || error?.name === 'AuthError';
}

/**
 * Get current auth token from storage
 */
export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

/**
 * Check if user is authenticated (has valid token in storage)
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return !!token;
}
