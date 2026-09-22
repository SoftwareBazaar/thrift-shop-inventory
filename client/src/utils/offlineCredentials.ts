import {
  derivePasswordHash,
  normaliseUsername,
  PASSWORD_REQUIREMENTS,
} from './passwordUtils';

export type OfflineUser = {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  stall_id?: number | null;
  status: string;
  created_date: string;
  phone_number?: string | null;
  email?: string | null;
  recovery_hint?: string | null;
  password_hash?: string | null;
  secret_word?: string | null;
};

type RecoveryInfo = {
  phone?: string | null;
  email?: string | null;
  hint?: string | null;
  updatedAt?: string | null;
};

type OfflineCredentialRecord = {
  user: OfflineUser;
  passwordVerifier: string;
  passwordUpdatedAt: string;
  recovery?: RecoveryInfo;
  source: 'seed' | 'server' | 'manual';
  lastLoginAt?: string | null;
  secretWord?: string | null;
};

type OfflineCredentialMap = Record<string, OfflineCredentialRecord>;

const STORAGE_KEY = 'thrift_shop_offline_credentials_v4';
const STORAGE_VERSION_KEY = 'thrift_shop_storage_version';
const CURRENT_STORAGE_VERSION = 'v5';

const safeParse = (value: string | null): OfflineCredentialMap => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const loadCredentialMap = (): OfflineCredentialMap => {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
};

const persistCredentialMap = (map: OfflineCredentialMap) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const mergeRecoveryInfo = (
  existing: RecoveryInfo | undefined,
  updates?: RecoveryInfo
): RecoveryInfo | undefined => {
  if (!existing && !updates) return undefined;
  return {
    phone: updates?.phone ?? existing?.phone ?? null,
    email: updates?.email ?? existing?.email ?? null,
    hint: updates?.hint ?? existing?.hint ?? null,
    updatedAt: updates
      ? updates.updatedAt ?? new Date().toISOString()
      : existing?.updatedAt ?? null,
  };
};

const extractRecoveryInfoFromUser = (
  user: OfflineCredentialRecord['user']
): RecoveryInfo | undefined => {
  if (!user) return undefined;
  if (!user.phone_number && !user.email) return undefined;
  return {
    phone: user.phone_number || undefined,
    email: user.email || undefined,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Migrate offline credential storage. Formerly seeded default admin/stall
 * passwords into every browser — those are purged and never re-written.
 */
export const ensureOfflineCredentialSeeds = async () => {
  if (typeof window === 'undefined') return;

  const lastVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);
  const map = loadCredentialMap();
  let didChange = false;

  if (lastVersion !== CURRENT_STORAGE_VERSION) {
    console.log(`[OfflineAuth] Upgrading storage from ${lastVersion} to ${CURRENT_STORAGE_VERSION}`);
    window.localStorage.removeItem('thrift_shop_credentials');
    window.localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
    didChange = true;
  }

  // Strip hardcoded seed accounts (admin/@Sta123$, kelvin, manuel, …).
  for (const key of Object.keys(map)) {
    if (map[key]?.source === 'seed') {
      delete map[key];
      didChange = true;
    }
  }

  if (didChange) {
    persistCredentialMap(map);
  }
};

export const getOfflineCredential = (
  username: string
): OfflineCredentialRecord | null => {
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  return map[key] ?? null;
};

export const removeOfflineCredential = (username: string) => {
  if (typeof window === 'undefined') return;
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  if (!map[key]) return;
  delete map[key];
  persistCredentialMap(map);
};

export const upsertOfflineCredentialFromPassword = async (
  user: OfflineUser,
  password: string,
  recovery?: RecoveryInfo,
  source: OfflineCredentialRecord['source'] = 'manual'
) => {
  if (!user?.username) return;
  await ensureOfflineCredentialSeeds();
  const map = loadCredentialMap();
  const key = normaliseUsername(user.username);
  const passwordVerifier = await derivePasswordHash(user.username, password);

  const existing = map[key];
  map[key] = {
    user: {
      ...(existing?.user ?? {}),
      ...user,
      // Never keep a raw password_hash on the device profile blob.
      password_hash: undefined,
    },
    passwordVerifier,
    passwordUpdatedAt: new Date().toISOString(),
    recovery: mergeRecoveryInfo(
      mergeRecoveryInfo(existing?.recovery, extractRecoveryInfoFromUser(user)),
      recovery
    ),
    source: source === 'seed' ? 'manual' : source,
    lastLoginAt: existing?.lastLoginAt ?? null,
    secretWord: existing?.secretWord ?? user.secret_word ?? null,
  };

  persistCredentialMap(map);
};

export const updateOfflinePassword = async (
  username: string,
  newPassword: string
) => {
  await ensureOfflineCredentialSeeds();
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  const record = map[key];
  if (!record) {
    throw new Error('Account not found in offline credentials');
  }

  const passwordVerifier = await derivePasswordHash(username, newPassword);
  map[key] = {
    ...record,
    passwordVerifier,
    passwordUpdatedAt: new Date().toISOString(),
    source: record.source === 'seed' ? 'manual' : record.source,
  };

  persistCredentialMap(map);
};

export const updateOfflineSecretWord = async (
  username: string,
  secretWord: string
) => {
  await ensureOfflineCredentialSeeds();
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  const record = map[key];
  if (!record) {
    throw new Error('Account not found in offline credentials');
  }

  map[key] = {
    ...record,
    secretWord: secretWord.trim(),
  };

  persistCredentialMap(map);
};

export const attemptOfflineLogin = async (
  username: string,
  password: string
): Promise<
  | {
    user: OfflineCredentialRecord['user'];
    passwordVersion: string;
  }
  | null
> => {
  await ensureOfflineCredentialSeeds();
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  const record = map[key];
  if (!record) return null;
  if (record.source === 'seed') return null;

  const inputVerifier = await derivePasswordHash(username, password);
  if (inputVerifier !== record.passwordVerifier) {
    return null;
  }

  map[key] = {
    ...record,
    lastLoginAt: new Date().toISOString(),
  };
  persistCredentialMap(map);

  return {
    user: record.user,
    passwordVersion: record.passwordVerifier,
  };
};

/** Profile-only sync. Never copies password_hash into the offline verifier. */
export const syncOfflineUserProfile = (user: OfflineUser) => {
  if (!user?.username) return;
  const map = loadCredentialMap();
  const key = normaliseUsername(user.username);
  const record = map[key];
  if (!record) return;

  const { password_hash: _ignored, ...safeUser } = user;

  map[key] = {
    ...record,
    secretWord: user.secret_word ?? record.secretWord ?? null,
    user: {
      ...record.user,
      ...safeUser,
      password_hash: undefined,
    },
    recovery: mergeRecoveryInfo(
      record.recovery,
      extractRecoveryInfoFromUser(user)
    ),
  };

  persistCredentialMap(map);
};

export const verifyRecoveryInput = (
  username: string,
  method: 'phone' | 'email',
  value: string
): { success: boolean; message?: string } => {
  const map = loadCredentialMap();
  const key = normaliseUsername(username);
  const record = map[key];

  if (!record) {
    return { success: false, message: 'Account not found' };
  }

  const recovery = record.recovery;
  if (!recovery) {
    return { success: false, message: 'Recovery information not configured' };
  }

  if (method === 'phone') {
    if (!recovery.phone) {
      return { success: false, message: 'No phone number on file' };
    }
    const cleanStored = recovery.phone.replace(/\D/g, '');
    const cleanInput = value.replace(/\D/g, '');

    if (cleanStored !== cleanInput) {
      return { success: false, message: 'Phone number does not match our records' };
    }
  } else {
    if (!recovery.email) {
      return { success: false, message: 'No email on file' };
    }
    if (recovery.email.trim().toLowerCase() !== value.trim().toLowerCase()) {
      return { success: false, message: 'Email does not match our records' };
    }
  }

  return { success: true };
};

export const getRecoveryRequirementsDescription = () =>
  `Passwords must be at least ${PASSWORD_REQUIREMENTS.minLength} characters with at least ${PASSWORD_REQUIREMENTS.minSpecial} special characters.`;
