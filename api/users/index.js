const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const adminError = requireAdmin(authResult.user);
    if (adminError) {
      return res.status(adminError.error.status).json({ message: adminError.error.message });
    }

    const { page = 1, limit = 50, role, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(`
        user_id,
        username,
        full_name,
        role,
        stall_id,
        status,
        phone_number,
        email,
        recovery_hint,
        created_date,
        stalls(stall_name)
      `)
      .order('created_date', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: users, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Transform users data
    const transformedUsers = users.map(user => ({
      ...user,
      stall_name: user.stalls?.stall_name
    }));

    res.json({
      users: transformedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: transformedUsers.length,
        pages: Math.ceil(transformedUsers.length / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

