const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

// Helper function to authenticate requests
async function authenticateToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: { message: 'Access token required', status: 401 } };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user details from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, full_name, role, stall_id, status')
      .eq('user_id', decoded.userId)
      .single();

    if (error || !user) {
      return { error: { message: 'Invalid token', status: 401 } };
    }

    if (user.status !== 'active') {
      return { error: { message: 'Account is inactive', status: 401 } };
    }

    return { user };
  } catch (error) {
    console.error('Token verification error:', error);
    return { error: { message: 'Invalid or expired token', status: 403 } };
  }
}

// Helper function to check admin role
function requireAdmin(user) {
  if (!user || user.role !== 'admin') {
    return { error: { message: 'Admin access required', status: 403 } };
  }
  return null;
}

module.exports = {
  authenticateToken,
  requireAdmin
};

