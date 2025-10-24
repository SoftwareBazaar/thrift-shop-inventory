const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, role, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by role
    if (role) {
      whereClause += ` AND role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users with stall information
    const usersQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.role,
        u.stall_id,
        u.status,
        u.created_date,
        s.stall_name
      FROM users u
      LEFT JOIN stalls s ON u.stall_id = s.stall_id
      ${whereClause}
      ORDER BY u.created_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const usersResult = await pool.query(usersQuery, queryParams);

    res.json({
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.user_id !== parseInt(id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const userQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.role,
        u.stall_id,
        u.status,
        u.created_date,
        s.stall_name
      FROM users u
      LEFT JOIN stalls s ON u.stall_id = s.stall_id
      WHERE u.user_id = $1
    `;

    const userResult = await pool.query(userQuery, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (Admin only or self)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, stall_id, status, password } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT user_id, role FROM users WHERE user_id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Users can only update their own profile (except role and status)
    if (req.user.role !== 'admin' && req.user.user_id !== parseInt(id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Non-admin users cannot change role, status, or stall_id
    if (req.user.role !== 'admin') {
      if (role || status || stall_id) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
    }

    let updateQuery = 'UPDATE users SET';
    const updateParams = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (full_name) {
      updateQuery += ` full_name = $${paramIndex}`;
      updateParams.push(full_name);
      paramIndex++;
    }

    if (role && req.user.role === 'admin') {
      if (paramIndex > 1) updateQuery += ',';
      updateQuery += ` role = $${paramIndex}`;
      updateParams.push(role);
      paramIndex++;
    }

    if (stall_id && req.user.role === 'admin') {
      if (paramIndex > 1) updateQuery += ',';
      updateQuery += ` stall_id = $${paramIndex}`;
      updateParams.push(stall_id);
      paramIndex++;
    }

    if (status && req.user.role === 'admin') {
      if (paramIndex > 1) updateQuery += ',';
      updateQuery += ` status = $${paramIndex}`;
      updateParams.push(status);
      paramIndex++;
    }

    if (password) {
      if (paramIndex > 1) updateQuery += ',';
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updateQuery += ` password_hash = $${paramIndex}`;
      updateParams.push(password_hash);
      paramIndex++;
    }

    if (paramIndex === 1) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateQuery += ` WHERE user_id = $${paramIndex} RETURNING *`;
    updateParams.push(id);

    const result = await pool.query(updateQuery, updateParams);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.user_id === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete by setting status to inactive
    await pool.query(
      'UPDATE users SET status = $1 WHERE user_id = $2',
      ['inactive', id]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all stalls (Admin only)
router.get('/stalls/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stallsQuery = `
      SELECT 
        s.stall_id,
        s.stall_name,
        s.status,
        u.full_name as assigned_user,
        u.username
      FROM stalls s
      LEFT JOIN users u ON s.user_id = u.user_id
      ORDER BY s.stall_name
    `;

    const stallsResult = await pool.query(stallsQuery);

    res.json({ stalls: stallsResult.rows });
  } catch (error) {
    console.error('Get stalls error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new stall (Admin only)
router.post('/stalls', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stall_name, user_id } = req.body;

    if (!stall_name) {
      return res.status(400).json({ message: 'Stall name is required' });
    }

    // Check if stall name already exists
    const existingStall = await pool.query(
      'SELECT stall_id FROM stalls WHERE stall_name = $1',
      [stall_name]
    );

    if (existingStall.rows.length > 0) {
      return res.status(400).json({ message: 'Stall name already exists' });
    }

    // If user_id is provided, verify user exists and is a 'user' role
    if (user_id) {
      const userResult = await pool.query(
        'SELECT user_id, role FROM users WHERE user_id = $1',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (userResult.rows[0].role !== 'user') {
        return res.status(400).json({ message: 'User must have user role' });
      }
    }

    // Create stall
    const result = await pool.query(
      'INSERT INTO stalls (stall_name, user_id) VALUES ($1, $2) RETURNING *',
      [stall_name, user_id]
    );

    res.status(201).json({
      message: 'Stall created successfully',
      stall: result.rows[0]
    });
  } catch (error) {
    console.error('Create stall error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update stall (Admin only)
router.put('/stalls/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { stall_name, user_id, status } = req.body;

    // Check if stall exists
    const existingStall = await pool.query(
      'SELECT stall_id FROM stalls WHERE stall_id = $1',
      [id]
    );

    if (existingStall.rows.length === 0) {
      return res.status(404).json({ message: 'Stall not found' });
    }

    // If user_id is provided, verify user exists and is a 'user' role
    if (user_id) {
      const userResult = await pool.query(
        'SELECT user_id, role FROM users WHERE user_id = $1',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (userResult.rows[0].role !== 'user') {
        return res.status(400).json({ message: 'User must have user role' });
      }
    }

    // Update stall
    const result = await pool.query(
      `UPDATE stalls 
       SET stall_name = COALESCE($1, stall_name),
           user_id = COALESCE($2, user_id),
           status = COALESCE($3, status)
       WHERE stall_id = $4 
       RETURNING *`,
      [stall_name, user_id, status, id]
    );

    res.json({
      message: 'Stall updated successfully',
      stall: result.rows[0]
    });
  } catch (error) {
    console.error('Update stall error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
