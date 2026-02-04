const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../../lib/supabase');

const MIN_PASSWORD_LENGTH = 6;
const MIN_SPECIAL_CHARS = 2;

const hasRequiredSpecialChars = (password) => {
  const specialChars = password.replace(/[A-Za-z0-9]/g, '');
  return specialChars.length >= MIN_SPECIAL_CHARS;
};

module.exports = async (req, res) => {
  // Set CORS and JSON headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {

    const { username, method, contact, newPassword } = req.body || {};

    if (!username || !method || !contact || !newPassword) {
      return res.status(400).json({ message: 'Username, method, contact, and new password are required' });
    }

    if (!['phone', 'email'].includes(method)) {
      return res.status(400).json({ message: 'Invalid recovery method. Use phone or email.' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
      });
    }

    if (!hasRequiredSpecialChars(newPassword)) {
      return res.status(400).json({
        message: `Password must include at least ${MIN_SPECIAL_CHARS} non-alphanumeric characters`
      });
    }

    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('user_id, username, status, phone_number, email')
      .eq('username', username)
      .single();

    if (fetchError || !userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userRecord.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    if (method === 'phone') {
      const storedPhone = (userRecord.phone_number || '').replace(/\D/g, '');
      const providedPhone = String(contact).replace(/\D/g, '');
      if (!storedPhone) {
        return res.status(400).json({ message: 'No phone number on file for this account' });
      }
      if (storedPhone !== providedPhone) {
        return res.status(400).json({ message: 'Phone number does not match our records' });
      }
    } else {
      const storedEmail = (userRecord.email || '').trim().toLowerCase();
      const providedEmail = String(contact).trim().toLowerCase();
      if (!storedEmail) {
        return res.status(400).json({ message: 'No email on file for this account' });
      }
      if (storedEmail !== providedEmail) {
        return res.status(400).json({ message: 'Email does not match our records' });
      }
    }

    // Use derivePasswordHash for password storage (same as client-side)
    // This ensures compatibility across all authentication flows
    const normalizedUsername = (username || '').trim().toLowerCase();
    const derivedHash = crypto.createHash('sha256')
      .update(normalizedUsername + '|' + newPassword)
      .digest('hex');

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: derivedHash })
      .eq('user_id', userRecord.user_id);

    if (updateError) {
      throw updateError;
    }

    // Return the password version for client sync
    const passwordVersion = derivedHash;

    return res.json({
      message: 'Password updated successfully',
      passwordVersion
    });
  } catch (error) {
    console.error('Recover password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


