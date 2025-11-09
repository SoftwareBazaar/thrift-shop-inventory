const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Get user from Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, password_hash, full_name, role, stall_id, status, phone_number, email')
      .eq('username', username)
      .single();

    if (error || !users) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users;

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const passwordVersion = crypto.createHash('sha256').update(user.password_hash || '').digest('hex');

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role, passwordVersion },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
      passwordVersion
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

