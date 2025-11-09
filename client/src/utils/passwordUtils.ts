import bcrypt from 'bcryptjs';

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_SPECIAL_CHARACTERS = 2;

export const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  minSpecial: MIN_SPECIAL_CHARACTERS,
};

export const normaliseUsername = (username: string) =>
  (username || '').trim().toLowerCase();

const countNonAlphanumeric = (value: string): number =>
  value.replace(/[A-Za-z0-9]/g, '').length;

export const validatePasswordStrength = (password: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (countNonAlphanumeric(password) < MIN_SPECIAL_CHARACTERS) {
    return `Password must include at least ${MIN_SPECIAL_CHARACTERS} non-alphanumeric characters`;
  }

  return null;
};

export const derivePasswordHash = async (
  username: string,
  password: string
): Promise<string> => {
  const input = `${normaliseUsername(username)}|${password}`;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buffer = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments without subtle crypto
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

export const hashPasswordWithBcrypt = async (password: string): Promise<string> =>
  bcrypt.hash(password, 10);

export const verifyBcryptHash = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);


