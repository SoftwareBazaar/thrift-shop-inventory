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
};

type OfflineCredentialMap = Record<string, OfflineCredentialRecord>;

const STORAGE_KEY = 'thrift_shop_offline_credentials_v3';

const seedUsers: Array<{
  user: OfflineCredentialRecord['user'];
  password: string;
  recovery?: RecoveryInfo;
  source?: OfflineCredentialRecord['source'];
}> = [
    {
      user: {
        user_id: 1,
        username: 'admin',
        full_name: 'System Administrator',
        role: 'admin',
        status: 'active',
        created_date: '2024-01-01T00:00:00.000Z',
        phone_number: '+254700000000',
        email: 'admin@example.com',
      },
      password: '@Sta123$',
      recovery: {
        phone: '+254700000000',
        email: 'admin@example.com',
        hint:
          'Default admin contact. Update to your real phone/email after first login.',
      },
      source: 'seed',
    },
    {
      user: {
        user_id: 2,
        username: 'kelvin',
        full_name: 'Kelvin',
        role: 'user',
        stall_id: 316,
        status: 'active',
        created_date: '2024-01-01T00:00:00.000Z',
        phone_number: '+254711111111',
        email: 'kelvin@example.com',
      },
      password: '@Sta123$',
      recovery: {
        phone: '+254711111111',
        email: 'kelvin@example.com',
        hint: 'Kelvin stall 316 phone',
      },
      source: 'seed',
    },
    {
      user: {
        user_id: 3,
        username: 'manuel',
        full_name: 'Manuel',
        role: 'user',
        stall_id: 309,
        status: 'active',
        created_date: '2024-01-01T00:00:00.000Z',
        phone_number: '+254722222222',
        email: 'manuel@example.com',
      },
      password: '@Sta123$',
      recovery: {
        phone: '+254722222222',
        email: 'manuel@example.com',
        hint: 'Manuel stall 309 phone',
      },
      source: 'seed',
    },
  ];

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

export const ensureOfflineCredentialSeeds = async () => {
  if (typeof window === 'undefined') return;
  const map = loadCredentialMap();
  let didChange = false;

  for (const seed of seedUsers) {
    const key = normaliseUsername(seed.user.username);
    if (!map[key]) {
      const passwordVerifier = await derivePasswordHash(
        seed.user.username,
        seed.password
      );
      map[key] = {
        user: seed.user,
        passwordVerifier,
        passwordUpdatedAt: new Date().toISOString(),
        recovery: mergeRecoveryInfo(
          extractRecoveryInfoFromUser(seed.user),
          seed.recovery
        ),
        source: seed.source ?? 'seed',
      };
      didChange = true;
    } else {
      // Ensure required fields (like recovery hint) stay up to date
      const record = map[key];
      const mergedRecovery = mergeRecoveryInfo(
        mergeRecoveryInfo(extractRecoveryInfoFromUser(record.user)),
        seed.recovery
      );

      // If the record is still a seed, ensure the password matches the seed password
      // This fixes issues where the hash algorithm might have changed or local data is stale
      let passwordVerifier = record.passwordVerifier;
      if (record.source === 'seed' || !record.source) {
        passwordVerifier = await derivePasswordHash(
          seed.user.username,
          seed.password
        );
      }

      map[key] = {
        ...record,
        passwordVerifier, // Update verifier if it was a seed
        user: {
          ...seed.user,
          ...record.user,
        },
        recovery: mergedRecovery,
      };
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
    },
    passwordVerifier,
    passwordUpdatedAt: new Date().toISOString(),
    recovery: mergeRecoveryInfo(
      mergeRecoveryInfo(existing?.recovery, extractRecoveryInfoFromUser(user)),
      recovery
    ),
    source: existing?.source === 'seed' && source !== 'seed' ? 'manual' : source,
    lastLoginAt: existing?.lastLoginAt ?? null,
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

export const syncOfflineUserProfile = (
  user: OfflineUser
) => {
  if (!user?.username) return;
  const map = loadCredentialMap();
  const key = normaliseUsername(user.username);
  const record = map[key];
  if (!record) return;

  map[key] = {
    ...record,
    user: {
      ...record.user,
      ...user,
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


