const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../../lib/supabase');
const { authenticateToken } = require('../_middleware');

const MIN_PASSWORD_LENGTH = 6;
const MIN_SPECIAL_CHARS = 2;

const hasRequiredSpecialChars = (password) => {
  const specialChars = password.replace(/[A-Za-z0-9]/g, '');
  return specialChars.length >= MIN_SPECIAL_CHARS;
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res
        .status(authResult.error.status)
        .json({ message: authResult.error.message });
    }

    const { oldPassword, newPassword } = req.body || {};

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    if (!hasRequiredSpecialChars(newPassword)) {
      return res.status(400).json({
        message: `Password must include at least ${MIN_SPECIAL_CHARS} non-alphanumeric characters`,
      });
    }

    const userId = authResult.user.user_id;

    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(
      oldPassword,
      userRecord.password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    const passwordVersion = crypto.createHash('sha256').update(newPasswordHash).digest('hex');

    return res.json({ message: 'Password updated successfully', passwordVersion });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

