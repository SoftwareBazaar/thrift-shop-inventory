const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user details from database
    const userResult = await pool.query(
      'SELECT user_id, username, full_name, role, stall_id, status FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = userResult.rows[0];
    
    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireUser = (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'User access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireUser
};
