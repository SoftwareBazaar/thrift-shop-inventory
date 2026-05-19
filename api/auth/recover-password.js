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
  console.log('🔍 Recover Password API Hit:', req.url);
  console.log('📍 Method:', req.method);
  console.log('📅 Deployed at:', new Date().toISOString());

  // Set JSON header (CORS is handled by vercel.json)
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse body if needed for Vercel compatibility
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON body' });
      }
    }

    const { username, newPassword, secretWordAnswers, secretWordPositions } = body || {};

    if (!username || !newPassword || !secretWordAnswers || !secretWordPositions) {
      return res.status(400).json({ message: 'Username, new password, answers, and positions are required' });
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
      .select('user_id, username, status, secret_word')
      .eq('username', username)
      .single();

    if (fetchError || !userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userRecord.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    if (!userRecord.secret_word) {
      return res.status(400).json({ message: 'No secret word configured for this account' });
    }

    // Verify secret word answers
    const storedSecretWord = userRecord.secret_word.trim().toLowerCase();
    let allCorrect = true;

    for (const pos of secretWordPositions) {
      const expectedChar = storedSecretWord[pos - 1];
      const providedChar = String(secretWordAnswers[pos] || '').trim().toLowerCase();

      if (expectedChar !== providedChar) {
        allCorrect = false;
        break;
      }
    }

    if (!allCorrect) {
      return res.status(401).json({ message: 'Incorrect heart/secret word answers' });
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


