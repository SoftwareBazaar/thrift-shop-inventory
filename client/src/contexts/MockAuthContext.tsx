import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '../services/dataService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (username: string, oldPassword: string, newPassword: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthMode = 'server';

const MIN_PASSWORD_LENGTH = 6;
const MIN_SPECIAL_CHARACTERS = 2;
const AUTH_MODE_STORAGE_KEY = 'thrift_shop_auth_mode';

const countNonAlphanumeric = (value: string): number => value.replace(/[A-Za-z0-9]/g, '').length;

export const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  minSpecial: MIN_SPECIAL_CHARACTERS,
};

export const validatePasswordStrength = (password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (countNonAlphanumeric(password) < MIN_SPECIAL_CHARACTERS) {
    return `Password must include at least ${MIN_SPECIAL_CHARACTERS} non-alphanumeric characters`;
  }

  return null;
};

type ServerLoginSuccess = { success: true; data: { token: string; user: User; passwordVersion?: string | null } };
type ServerLoginUnavailable = { unavailable: true };
type ServerLoginError = { error: string; status: number };
type ServerLoginResult = ServerLoginSuccess | ServerLoginUnavailable | ServerLoginError;

const CREDENTIAL_CACHE_KEY = 'thrift_shop_credentials';
const PASSWORD_VERSION_KEY = 'thrift_shop_password_version';

interface CredentialCacheEntry {
  passwordHash: string;
  user: User;
  passwordVersion?: string | null;
  updatedAt: string;
}

const normaliseUsername = (username: string) => username.trim().toLowerCase();

const readCredentialCache = (): Record<string, CredentialCacheEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(CREDENTIAL_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const writeCredentialCache = (cache: Record<string, CredentialCacheEntry>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CREDENTIAL_CACHE_KEY, JSON.stringify(cache));
};

const getCredentialEntry = (username: string): CredentialCacheEntry | null => {
  const cache = readCredentialCache();
  return cache[normaliseUsername(username)] || null;
};

const derivePasswordHash = async (username: string, password: string): Promise<string> => {
  const input = `${normaliseUsername(username)}|${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buffer = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without subtle crypto
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const cacheCredentials = async (user: User, password: string, passwordVersion?: string | null) => {
  if (typeof window === 'undefined') return;
  const cache = readCredentialCache();
  cache[normaliseUsername(user.username)] = {
    passwordHash: await derivePasswordHash(user.username, password),
    user,
    passwordVersion: passwordVersion ?? null,
    updatedAt: new Date().toISOString()
  };
  writeCredentialCache(cache);
};

export const MockAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordVersion, setPasswordVersion] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PASSWORD_VERSION_KEY);
  });
  const [authMode, setAuthMode] = useState<AuthMode>('server');

  const persistAuthMode = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
    }
  }, []);

  const persistPasswordVersion = useCallback((version: string | null) => {
    setPasswordVersion(version);
    if (typeof window === 'undefined') return;
    if (version) {
      localStorage.setItem(PASSWORD_VERSION_KEY, version);
    } else {
      localStorage.removeItem(PASSWORD_VERSION_KEY);
    }
  }, []);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    const initialise = async () => {
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));

        if (authMode === 'server') {
          try {
            const response = await fetch('/api/auth/profile', {
              headers: {
                Authorization: `Bearer ${savedToken}`,
              },
            });

            if (response.ok) {
              const data = await response.json();
              setUser(data.user);
              localStorage.setItem('user', JSON.stringify(data.user));
              persistAuthMode('server');
            } else if (response.status === 401 || response.status === 403) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setToken(null);
              setUser(null);
            }
          } catch (error) {
            console.warn('Auth profile check failed, continuing with cached session.', error);
          }
        }
      }

      setLoading(false);
    };

    initialise();
  }, [authMode, persistAuthMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PASSWORD_VERSION_KEY) return;
      if (!token) return;
      if (!event.newValue || event.newValue !== passwordVersion) {
        logout();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [logout, passwordVersion, token]);

  const login = async (username: string, password: string): Promise<void> => {
    setLoading(true);
    
    try {
      const serverAttempt: ServerLoginResult = await (async () => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          if (response.ok) {
            const data = await response.json();
            return { success: true as const, data: data as { token: string; user: User } };
          }

          if (response.status === 404 || response.status === 405) {
            return { unavailable: true as const };
          }

          const errorData = await response.json().catch(() => ({}));
          return {
            error: (errorData as { message?: string }).message || 'Login failed',
            status: response.status,
          };
        } catch (error) {
          return { unavailable: true as const };
        }
      })();

      if ('success' in serverAttempt && serverAttempt.success) {
        const { token: authToken, user: authUser, passwordVersion: serverPasswordVersion } = serverAttempt.data;
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(authUser));
        setToken(authToken);
        setUser(authUser);
        persistAuthMode('server');
        persistPasswordVersion(serverPasswordVersion ?? null);
        await cacheCredentials(authUser, password, serverPasswordVersion ?? null);
        return;
      }

      if (!('unavailable' in serverAttempt && serverAttempt.unavailable)) {
        const message = 'error' in serverAttempt ? serverAttempt.error : 'Login failed';
        throw new Error(message);
      }

      const cachedEntry = getCredentialEntry(username);
      if (!cachedEntry) {
        throw new Error('Unable to reach the server. Connect to the internet to sign in for the first time.');
      }

      const offlineHash = await derivePasswordHash(username, password);
      if (offlineHash !== cachedEntry.passwordHash) {
        throw new Error('Invalid password');
      }

      const offlineToken = `offline_token_${Date.now()}_${username}`;
      localStorage.setItem('token', offlineToken);
      localStorage.setItem('user', JSON.stringify(cachedEntry.user));

      setToken(offlineToken);
      setUser(cachedEntry.user);
      persistAuthMode('server');
      persistPasswordVersion(cachedEntry.passwordVersion ?? passwordVersion ?? null);
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const changePassword = async (
    username: string,
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    const validationError = validatePasswordStrength(newPassword);
    if (validationError) {
      throw new Error(validationError);
    }

    if (!token || !user) {
      throw new Error('You must be signed in to change your password');
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        const newPasswordVersion = (result as { passwordVersion?: string | null }).passwordVersion ?? null;
        await cacheCredentials(user, newPassword, newPasswordVersion);
        persistPasswordVersion(newPasswordVersion);
        logout();
        return true;
      }

      if (response.status === 401) {
        return false;
      }

      const errorData = await response.json().catch(() => ({}));
      const message = (errorData as { message?: string }).message || 'Unable to change password';

      throw new Error(message);
    } catch (error: any) {
      if (error?.message && error.message.includes('Failed to fetch')) {
        throw new Error('Unable to change password while offline. Please reconnect and try again.');
      }
      throw new Error(error?.message || 'Unable to change password');
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    changePassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
