import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { User } from '../services/dataService';
import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
    // Check for existing session
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    const initialise = async () => {
      await ensureOfflineCredentialSeeds();

      if (savedToken && savedUser) {
        const parsedUser = JSON.parse(savedUser) as User;
        setToken(savedToken);
        setUser(parsedUser);
        syncOfflineUserProfile(toOfflineUser(parsedUser));

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
              // Check if session was invalidated due to password change
              try {
                const errorData = await response.json();
                if (errorData.passwordChanged || errorData.sessionInvalidated) {
                  console.log('Session invalidated - password was changed on another device');
                }
              } catch (e) {
                // Ignore JSON parse errors
              }

              // Clear invalid session
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
    const normalised = normaliseUsername(username);
    let availabilityError: Error | null = null;
    let serverReportedInvalid = false;

    try {
      await ensureOfflineCredentialSeeds();

      const online = typeof navigator === 'undefined' ? true : navigator.onLine;
      const canUseServer = isSupabaseConfigured() && online;

      if (canUseServer) {
        try {
          const { data: userRow, error: fetchError } = await (supabase as any)
            .from('users')
            .select('user_id, username, password_hash, full_name, role, stall_id, status, phone_number, email')
            .or(`username.eq."${username}",email.eq."${username.toLowerCase()}"`)
            .single();

          if (fetchError || !userRow) {
            const errorMessage = (fetchError?.message || '').toLowerCase();
            const statusCode = (fetchError as any)?.status || (fetchError as any)?.code;
            // Treat 406 (Not Acceptable) and other non-auth errors as availability issues, not invalid credentials
            if (statusCode === 406 || statusCode === '406') {
              availabilityError = new Error('Server configuration issue. Using offline mode.');
            } else if (errorMessage.includes('invalid') || fetchError?.code === 'PGRST116') {
              serverReportedInvalid = true;
            } else {
              availabilityError = new Error(fetchError?.message || 'Unable to reach authentication server');
            }
            throw availabilityError ?? new Error('Unable to reach authentication server');
          }

          if (userRow.status && userRow.status !== 'active') {
            throw new Error('Account is inactive');
          }


          // Robust Hashing Logic (matches changePassword implementation)
          const dbUsername = userRow.username;
          const currentHashInDb = (userRow.password_hash || '').trim();

          const expectedHash = await derivePasswordHash(dbUsername, password);
          let matches = expectedHash === currentHashInDb;

          console.log('[Login] Verifying credentials:', {
            attemptedUser: username,
            dbUser: dbUsername,
            match: matches
          });

          if (!matches) {
            // Check if context username derivation works (handle casing mismatch edge case)
            const alternateHash = await derivePasswordHash(username, password);
            if (alternateHash === currentHashInDb) {
              console.log('[Login] Matched via alternate username casing');
              matches = true;
            }
          }

          if (!matches) {
            // Fallback: try bcrypt in case some users still have old hashes
            const bcryptMatches = await bcrypt.compare(password, currentHashInDb);
            if (bcryptMatches) {
              console.log('[Login] Matched via bcrypt fallback');
              matches = true;
            }
          }

          if (!matches) {
            console.warn('[Login] Password mismatch - all verifiers failed');
            serverReportedInvalid = true;
            throw new Error('Invalid credentials');
          }

          const { password_hash, ...authUser } = userRow;

          const authToken = `supabase_token_${Date.now()}_${normalised}`;
          localStorage.setItem('token', authToken);
          localStorage.setItem('user', JSON.stringify(authUser));
          setToken(authToken);
          setUser(authUser);
          persistAuthMode('server');
          const passwordVersion = await derivePasswordHash(username, password);
          persistPasswordVersion(passwordVersion);
          await cacheCredentials(authUser, password, passwordVersion);
          return;
        } catch (serverError: any) {
          const statusCode = serverError?.status || serverError?.code;
          // 406 errors should fall back to offline, not be treated as invalid credentials
          if (statusCode === 406 || statusCode === '406') {
            availabilityError = new Error('Server configuration issue. Using offline mode.');
          } else if (serverError instanceof Error && serverError.message === 'Invalid credentials') {
            serverReportedInvalid = true;
          }
          console.warn('Server login failed, trying offline credentials', serverError);
          if (!availabilityError) {
            availabilityError =
              serverError instanceof Error
                ? serverError
                : new Error('Unable to reach authentication server');
          }
        }
      }



      // CRITICAL SECURITY FIX:
      // If the server was reachable and explicitly rejected the password, 
      // do NOT fall back to offline credentials (which might be stale).
      if (serverReportedInvalid) {
        console.warn('Server explicitly rejected credentials. Skipping offline fallback.');
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

      if (availabilityError) {
        throw new Error('Unable to reach the server. Connect to the internet to sign in for the first time.');
      }

      const offlineRecord = getOfflineCredential(username);
      if (!offlineRecord) {
        throw new Error('This account has not been synced for offline access yet. Connect to the internet once while signing in to enable offline login.');
      }

      if (serverReportedInvalid) {
        throw new Error('Invalid credentials');
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
    const supabaseReady = isSupabaseConfigured();

    try {
      if (supabaseReady && online) {
        const { data: existingUser, error: fetchError } = await (supabase as any)
          .from('users')
          .select('password_hash, username')
          .eq('user_id', user.user_id)
          .single();

        if (fetchError || !existingUser) {
          console.error('[ChangePassword] Fetch error:', fetchError);
          throw new Error('Unable to verify your account. Please try again.');
        }

        const dbUsername = existingUser.username || user.username;
        const currentHashInDb = (existingUser.password_hash || '').trim();

        // Step 1: Check against the local session's password version
        // This is the most reliable check if they were able to log in
        const enteredVersion = await derivePasswordHash(user.username, oldPassword);
        let matches = enteredVersion === passwordVersion;

        if (matches) {
          console.log('[ChangePassword] Verified via session password version');
        } else {
          // Step 2: Fallback to DB hash check (custom derivation)
          const expectedFromDb = await derivePasswordHash(dbUsername, oldPassword);
          matches = expectedFromDb === currentHashInDb;

          if (matches) {
            console.log('[ChangePassword] Verified via DB custom hash');
          } else {
            // Step 3: Fallback to bcrypt for legacy hashes
            try {
              matches = await bcrypt.compare(oldPassword, currentHashInDb);
              if (matches) console.log('[ChangePassword] Verified via bcrypt fallback');
            } catch (e) {
              console.warn('[ChangePassword] Bcrypt comparison failed:', e);
            }
          }
        }

        if (!matches) {
          console.warn('[ChangePassword] Debug Final Failure:', {
            dbUsername,
            sessionUsername: user.username,
            hasPasswordVersion: !!passwordVersion,
            passwordVersionPrefix: passwordVersion?.substring(0, 8),
            enteredVersionPrefix: enteredVersion.substring(0, 8),
            dbHashPrefix: currentHashInDb.substring(0, 8)
          });
          return false;
        }

        const newHash = await derivePasswordHash(dbUsername, newPassword);
        const { error: updateError } = await (supabase as any)
          .from('users')
          .update({ password_hash: newHash })
          .eq('user_id', user.user_id);

        if (updateError) {
          throw new Error(updateError.message || 'Failed to update password.');
        }

        // Password changed successfully - all sessions are now invalidated
        const newPasswordVersion = newHash;

        // CRITICAL: Clear the old credential cache to prevent stale password usage
        if (typeof window !== 'undefined') {
          const cache = readCredentialCache();
          const key = normaliseUsername(username);
          if (cache[key]) {
            delete cache[key];
            writeCredentialCache(cache);
          }
        }

        // Update offline credentials immediately with proper source marking
        await updateOfflinePasswordStore(username, newPassword);
        await upsertOfflineCredentialFromPassword(
          toOfflineUser(user),
          newPassword,
          {
            phone: (user as any)?.phone_number ?? undefined,
            email: (user as any)?.email ?? undefined
          },
          'manual' // Mark as manual to prevent seed logic from overwriting
        );

        // Update the credential cache with new password
        await cacheCredentials(user, newPassword, newPasswordVersion);
        persistPasswordVersion(newPasswordVersion);

        // Force logout immediately - session is now invalid on server
        logout();

        return true;
      }

      // Offline fallback - password change without server
      const offlineAuth = await attemptOfflineLogin(username, oldPassword);
      if (!offlineAuth) {
        return false;
      }

      // Clear old credential cache
      if (typeof window !== 'undefined') {
        const cache = readCredentialCache();
        const key = normaliseUsername(username);
        if (cache[key]) {
          delete cache[key];
          writeCredentialCache(cache);
        }
      }

      // Update offline password with manual source marking
      await updateOfflinePasswordStore(username, newPassword);
      await upsertOfflineCredentialFromPassword(
        toOfflineUser(user),
        newPassword,
        {
          phone: (user as any)?.phone_number ?? undefined,
          email: (user as any)?.email ?? undefined
        },
        'manual'
      );

      const newPasswordVersion = await derivePasswordHash(username, newPassword);
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
