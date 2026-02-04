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
      'SELECT user_id, username, full_name, role, stall_id, status, password_version FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = userResult.rows[0];

    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Validate session exists and password version matches
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const sessionResult = await pool.query(
      'SELECT session_id, password_version, expires_at FROM sessions WHERE token_hash = $1 AND user_id = $2',
      [tokenHash, user.user_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        message: 'Session invalid or expired. Please log in again.',
        sessionInvalidated: true
      });
    }

    const session = sessionResult.rows[0];

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await pool.query('DELETE FROM sessions WHERE session_id = $1', [session.session_id]);
      return res.status(401).json({
        message: 'Session expired. Please log in again.',
        sessionExpired: true
      });
    }

    // Check if password has been changed (password version mismatch)
    if (session.password_version !== user.password_version) {
      // Delete invalidated session
      await pool.query('DELETE FROM sessions WHERE session_id = $1', [session.session_id]);
      return res.status(401).json({
        message: 'Password has been changed. Please log in with your new password.',
        passwordChanged: true
      });
    }

    // Update last activity timestamp
    pool.query(
      'UPDATE sessions SET last_activity = NOW() WHERE session_id = $1',
      [session.session_id]
    ).catch(err => console.warn('Failed to update session activity:', err));

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
