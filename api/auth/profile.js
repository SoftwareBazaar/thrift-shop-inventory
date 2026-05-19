const supabase = require('../../lib/supabase');
const { authenticateToken } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const authResult = await authenticateToken(req);
      if (authResult.error) {
        return res.status(authResult.error.status).json({ message: authResult.error.message });
      }

      const { password_hash, ...userWithoutPassword } = authResult.user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const authResult = await authenticateToken(req);
      if (authResult.error) {
        return res.status(authResult.error.status).json({ message: authResult.error.message });
      }

      const { full_name, password, phone_number, email, recovery_hint } = req.body;
      const userId = authResult.user.user_id;

      const updateData = {};
      if (full_name) updateData.full_name = full_name;
      if (phone_number !== undefined) {
        updateData.phone_number = phone_number ? String(phone_number) : null;
      }
      if (email !== undefined) {
        updateData.email = email ? String(email).toLowerCase() : null;
      }
      if (recovery_hint !== undefined) {
        updateData.recovery_hint = recovery_hint ? String(recovery_hint) : null;
      }

      if (updateData.phone_number || updateData.email || updateData.recovery_hint) {
        updateData.recovery_updated_at = new Date().toISOString();
      }

      // Update password if provided
      if (password) {
        const bcrypt = require('bcryptjs');
        const saltRounds = 10;
        updateData.password_hash = await bcrypt.hash(password, saltRounds);
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', userId)
        .select('user_id, username, full_name, role, stall_id, status, phone_number, email, recovery_hint')
        .single();

      if (error) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
};

