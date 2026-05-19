const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Authenticate request
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const user = authResult.user;

    // Check if user is admin
    const adminError = requireAdmin(user);
    if (adminError) {
      return res.status(adminError.error.status).json({ message: adminError.error.message });
    }

    const { username, password, full_name, role, stall_id, phone_number, email, recovery_hint } = req.body;

    // Validate required fields
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          password_hash,
          full_name,
          role,
          stall_id: stall_id || null,
          status: 'active',
          phone_number: phone_number ? String(phone_number) : null,
          email: email ? String(email).toLowerCase() : null,
          recovery_hint: recovery_hint ? String(recovery_hint) : null,
          recovery_updated_at: phone_number || email || recovery_hint ? new Date().toISOString() : null
        }
      ])
      .select('user_id, username, full_name, role, stall_id, status, phone_number, email, recovery_hint')
      .single();

    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

