import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { User } from '../services/dataService';
import {
  PASSWORD_REQUIREMENTS,
  validatePasswordStrength,
  derivePasswordHash,
  normaliseUsername,
} from '../utils/passwordUtils';
import type { OfflineUser } from '../utils/offlineCredentials';
import {
  ensureOfflineCredentialSeeds,
  attemptOfflineLogin,
  upsertOfflineCredentialFromPassword,
  updateOfflinePassword as updateOfflinePasswordStore,
  syncOfflineUserProfile,
  getOfflineCredential,
} from '../utils/offlineCredentials';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (username: string, oldPassword: string, newPassword: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthMode = 'server' | 'offline';
const AUTH_MODE_STORAGE_KEY = 'thrift_shop_auth_mode';

const CREDENTIAL_CACHE_KEY = 'thrift_shop_credentials';
const PASSWORD_VERSION_KEY = 'thrift_shop_password_version';

interface CredentialCacheEntry {
  passwordHash: string;
  user: User;
  passwordVersion?: string | null;
  updatedAt: string;
}

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

const toOfflineUser = (user: User): OfflineUser => ({
  user_id: user.user_id,
  username: user.username,
  full_name: user.full_name,
  role: user.role,
  stall_id: (user as any)?.stall_id != null ? Number((user as any).stall_id) : null,
  status: (user as any)?.status ?? 'active',
  created_date: (user as any)?.created_date ?? new Date().toISOString(),
  phone_number: (user as any)?.phone_number ?? null,
  email: (user as any)?.email ?? null,
  recovery_hint: (user as any)?.recovery_hint ?? null,
  secret_word: (user as any)?.secret_word ?? null,
});

const fromOfflineUser = (user: OfflineUser): User => ({
  user_id: user.user_id,
  username: user.username,
  full_name: user.full_name,
  role: user.role,
  stall_id: user.stall_id != null ? Number(user.stall_id) : undefined,
  status: user.status,
  created_date: user.created_date,
  phone_number: user.phone_number ?? null,
  email: user.email ?? null,
  recovery_hint: user.recovery_hint ?? null,
  secret_word: user.secret_word ?? null,
});

const cacheCredentials = async (user: User, password: string, passwordVersion?: string | null) => {
  if (typeof window === 'undefined') return;
  const cache = readCredentialCache();
  const derivedVersion = passwordVersion ?? (await derivePasswordHash(user.username, password));
  cache[normaliseUsername(user.username)] = {
    passwordHash: derivedVersion,
    user,
    passwordVersion: derivedVersion,
    updatedAt: new Date().toISOString()
  };
  writeCredentialCache(cache);

  await upsertOfflineCredentialFromPassword(
    toOfflineUser(user),
    password,
    {
      phone: (user as any)?.phone_number ?? undefined,
      email: (user as any)?.email ?? undefined
    },
    'server'
  );
};

export const MockAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordVersion, setPasswordVersion] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PASSWORD_VERSION_KEY);
  });
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (typeof window === 'undefined') return 'server';
    const stored = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode | null;
    return stored === 'offline' ? 'offline' : 'server';
  });

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

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    const initialise = async () => {
      try {
        await ensureOfflineCredentialSeeds();

        if (savedToken && savedUser) {
          let parsedUser: User;
          try {
            parsedUser = JSON.parse(savedUser) as User;
          } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setLoading(false);
            return;
          }

          setToken(savedToken);
          setUser(parsedUser);
          syncOfflineUserProfile(toOfflineUser(parsedUser));

          // Fake / offline tokens cannot pass jwt.verify — skip the profile
          // round-trip so we do not wipe a valid offline session.
          const looksLikeJwt = savedToken.split('.').length === 3;

          if (authMode === 'server' && looksLikeJwt) {
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
                try {
                  const errorData = await response.json();
                  if (errorData.passwordChanged || errorData.sessionInvalidated) {
                    console.log('Session invalidated - password was changed on another device');
                  }
                } catch {
                  // ignore body parse errors
                }

                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setToken(null);
                setUser(null);
              }
            } catch (error) {
              console.warn('Auth profile check failed, continuing with cached session.', error);
            }
          } else if (authMode === 'server' && !looksLikeJwt) {
            // Legacy invented tokens — clear so the operator signs in for a real JWT.
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
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
    const normalised = normaliseUsername(username);
    let availabilityError: Error | null = null;
    let serverReportedInvalid = false;

    try {
      await ensureOfflineCredentialSeeds();

      const online = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (online) {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (response.status === 401) {
            serverReportedInvalid = true;
            throw new Error('Invalid credentials');
          }

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            availabilityError = new Error(
              (body as any)?.message || `Login server error (${response.status})`
            );
            throw availabilityError;
          }

          const data = await response.json();
          const authUser = data.user as User;
          const authToken = data.token as string;

          if (!authToken || !authUser) {
            availabilityError = new Error('Login server returned an incomplete response');
            throw availabilityError;
          }

          localStorage.setItem('token', authToken);
          localStorage.setItem('user', JSON.stringify(authUser));
          setToken(authToken);
          setUser(authUser);
          persistAuthMode('server');
          const localVersion =
            (data.passwordVersion as string | undefined) ||
            (await derivePasswordHash(authUser.username || username, password));
          persistPasswordVersion(localVersion);
          await cacheCredentials(authUser, password, localVersion);
          return;
        } catch (serverError: any) {
          if (serverError instanceof Error && serverError.message === 'Invalid credentials') {
            serverReportedInvalid = true;
          } else if (!availabilityError) {
            availabilityError =
              serverError instanceof Error
                ? serverError
                : new Error('Unable to reach authentication server');
          }
          console.warn('Server login failed, trying offline credentials', serverError);
        }
      }

      // Server rejected the password — never fall back to a stale offline copy.
      if (serverReportedInvalid) {
        throw new Error('Invalid credentials');
      }

      const offlineResult = await attemptOfflineLogin(username, password);
      if (offlineResult) {
        const offlineToken = `offline_token_${Date.now()}_${normalised}`;
        const offlineUser = fromOfflineUser(offlineResult.user);
        localStorage.setItem('token', offlineToken);
        localStorage.setItem('user', JSON.stringify(offlineUser));
        setToken(offlineToken);
        setUser(offlineUser);
        persistAuthMode('offline');
        persistPasswordVersion(offlineResult.passwordVersion);
        return;
      }

      const cachedEntry = getCredentialEntry(username);
      if (cachedEntry !== null) {
        const { passwordHash, user: cachedUser, passwordVersion: cachedVersion } = cachedEntry;
        const offlineHash = await derivePasswordHash(username, password);
        if (offlineHash === passwordHash) {
          const offlineToken = `offline_token_${Date.now()}_${normalised}`;
          localStorage.setItem('token', offlineToken);
          localStorage.setItem('user', JSON.stringify(cachedUser));
          setToken(offlineToken);
          setUser(cachedUser);
          persistAuthMode('offline');
          persistPasswordVersion(cachedVersion ?? offlineHash);
          return;
        }
      }

      if (availabilityError || !online) {
        throw new Error(
          'Unable to reach the server. Connect once while signing in to enable offline login on this device.'
        );
      }

      const offlineRecord = getOfflineCredential(username);
      if (!offlineRecord) {
        throw new Error(
          'This account has not been synced for offline access yet. Connect to the internet once while signing in.'
        );
      }

      throw new Error('Login failed');
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

    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const looksLikeJwt = token.split('.').length === 3;

    if (!online || !looksLikeJwt) {
      throw new Error(
        'Password changes require an internet connection so every device stays in sync. Reconnect and try again.'
      );
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

      if (response.status === 401) {
        return false;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as any)?.message || 'Failed to update password.');
      }

      const data = await response.json().catch(() => ({}));
      const newPasswordVersion =
        (data as any)?.passwordVersion ||
        (await derivePasswordHash(user.username || username, newPassword));

      if (typeof window !== 'undefined') {
        const cache = readCredentialCache();
        const key = normaliseUsername(username);
        if (cache[key]) {
          delete cache[key];
          writeCredentialCache(cache);
        }
      }

      await updateOfflinePasswordStore(username, newPassword).catch(async () => {
        await upsertOfflineCredentialFromPassword(
          toOfflineUser(user),
          newPassword,
          {
            phone: (user as any)?.phone_number ?? undefined,
            email: (user as any)?.email ?? undefined,
          },
          'manual'
        );
      });

      await upsertOfflineCredentialFromPassword(
        toOfflineUser(user),
        newPassword,
        {
          phone: (user as any)?.phone_number ?? undefined,
          email: (user as any)?.email ?? undefined,
        },
        'manual'
      );

      await cacheCredentials(user, newPassword, newPasswordVersion);
      persistPasswordVersion(newPasswordVersion);
      logout();
      return true;
    } catch (error: any) {
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

export { PASSWORD_REQUIREMENTS, validatePasswordStrength };
