const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const adminError = requireAdmin(authResult.user);
    if (adminError) {
      return res.status(adminError.error.status).json({ message: adminError.error.message });
    }

    if (req.method === 'GET') {
      // Get all stalls
      const { data: stalls, error } = await supabase
        .from('stalls')
        .select(`
          stall_id,
          stall_name,
          status,
          users(username, full_name)
        `)
        .order('stall_name');

      if (error) {
        return res.status(500).json({ message: 'Internal server error' });
      }

      const transformedStalls = stalls.map(stall => ({
        stall_id: stall.stall_id,
        stall_name: stall.stall_name,
        status: stall.status,
        assigned_user: stall.users?.full_name,
        username: stall.users?.username
      }));

      res.json({ stalls: transformedStalls });
    } else if (req.method === 'POST') {
      // Create new stall
      const { stall_name, user_id } = req.body;

      if (!stall_name) {
        return res.status(400).json({ message: 'Stall name is required' });
      }

      const { data: newStall, error } = await supabase
        .from('stalls')
        .insert([{ stall_name, user_id: user_id || null }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ message: 'Stall name already exists' });
        }
        return res.status(500).json({ message: 'Internal server error' });
      }

      res.status(201).json({
        message: 'Stall created successfully',
        stall: newStall
      });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Stalls operation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

