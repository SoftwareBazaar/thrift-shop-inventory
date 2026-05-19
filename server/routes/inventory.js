const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all items (with filtering and pagination)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      category, 
      search, 
      low_stock,
      stall_id 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // If user is not admin, only show items from their stall
    if (req.user.role === 'user' && req.user.stall_id) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM stock_distribution sd 
        WHERE sd.item_id = i.item_id AND sd.stall_id = $${paramIndex}
      )`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    }

    // Filter by category
    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    // Search by item name
    if (search) {
      whereClause += ` AND item_name ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filter low stock items
    if (low_stock === 'true') {
      whereClause += ` AND current_stock <= 5`; // Configurable threshold
    }

    // Filter by stall (admin only)
    if (stall_id && req.user.role === 'admin') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM stock_distribution sd 
        WHERE sd.item_id = i.item_id AND sd.stall_id = $${paramIndex}
      )`;
      queryParams.push(stall_id);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM items i ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalItems = parseInt(countResult.rows[0].count);

    // Get items with stock distribution info
    const itemsQuery = `
      SELECT 
        i.*,
        COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
        COALESCE(SUM(sa.quantity_added), 0) as total_added
      FROM items i
      LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
      LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
      ${whereClause}
      GROUP BY i.item_id
      ORDER BY i.date_added DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const itemsResult = await pool.query(itemsQuery, queryParams);

    res.json({
      items: itemsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalItems,
        pages: Math.ceil(totalItems / limit)
      }
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single item by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const itemQuery = `
      SELECT 
        i.*,
        COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
        COALESCE(SUM(sa.quantity_added), 0) as total_added
      FROM items i
      LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
      LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
      WHERE i.item_id = $1
      GROUP BY i.item_id
    `;

    const itemResult = await pool.query(itemQuery, [id]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get stock distribution details for this item
    const distributionQuery = `
      SELECT 
        sd.*,
        s.stall_name,
        u.full_name as distributed_by_name
      FROM stock_distribution sd
      JOIN stalls s ON sd.stall_id = s.stall_id
      JOIN users u ON sd.distributed_by = u.user_id
      WHERE sd.item_id = $1
      ORDER BY sd.date_distributed DESC
    `;

    const distributionResult = await pool.query(distributionQuery, [id]);

    res.json({
      item: itemResult.rows[0],
      distribution: distributionResult.rows
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new item (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      item_name, 
      category, 
      initial_stock, 
      unit_price, 
      sku 
    } = req.body;

    // Validate required fields
    if (!item_name || !category || !initial_stock || !unit_price) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if SKU already exists
    if (sku) {
      const existingSku = await pool.query(
        'SELECT item_id FROM items WHERE sku = $1',
        [sku]
      );
      if (existingSku.rows.length > 0) {
        return res.status(400).json({ message: 'SKU already exists' });
      }
    }

    // Insert new item
    const result = await pool.query(
      `INSERT INTO items (item_name, category, initial_stock, current_stock, unit_price, sku, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [item_name, category, initial_stock, initial_stock, unit_price, sku, req.user.user_id]
    );

    res.status(201).json({
      message: 'Item created successfully',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update item (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, category, unit_price, sku } = req.body;

    // Check if item exists
    const existingItem = await pool.query(
      'SELECT item_id FROM items WHERE item_id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if SKU already exists (if provided and different)
    if (sku) {
      const existingSku = await pool.query(
        'SELECT item_id FROM items WHERE sku = $1 AND item_id != $2',
        [sku, id]
      );
      if (existingSku.rows.length > 0) {
        return res.status(400).json({ message: 'SKU already exists' });
      }
    }

    // Update item
    const result = await pool.query(
      `UPDATE items 
       SET item_name = COALESCE($1, item_name),
           category = COALESCE($2, category),
           unit_price = COALESCE($3, unit_price),
           sku = COALESCE($4, sku)
       WHERE item_id = $5 
       RETURNING *`,
      [item_name, category, unit_price, sku, id]
    );

    res.json({
      message: 'Item updated successfully',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add stock to existing item
router.post('/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_added } = req.body;

    if (!quantity_added || quantity_added <= 0) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    // Check if item exists
    const itemResult = await pool.query(
      'SELECT item_id, current_stock FROM items WHERE item_id = $1',
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Add to stock_additions table
      await pool.query(
        'INSERT INTO stock_additions (item_id, quantity_added, added_by) VALUES ($1, $2, $3)',
        [id, quantity_added, req.user.user_id]
      );

      // Update current_stock in items table
      const updatedItem = await pool.query(
        'UPDATE items SET current_stock = current_stock + $1 WHERE item_id = $2 RETURNING *',
        [quantity_added, id]
      );

      await pool.query('COMMIT');

      res.json({
        message: 'Stock added successfully',
        item: updatedItem.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Distribute stock to stalls (Admin only)
router.post('/:id/distribute', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { stall_id, quantity_allocated } = req.body;

    if (!stall_id || !quantity_allocated || quantity_allocated <= 0) {
      return res.status(400).json({ message: 'Valid stall and quantity are required' });
    }

    // Check if item exists and has enough stock
    const itemResult = await pool.query(
      'SELECT current_stock FROM items WHERE item_id = $1',
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (itemResult.rows[0].current_stock < quantity_allocated) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

    // Check if stall exists
    const stallResult = await pool.query(
      'SELECT stall_id FROM stalls WHERE stall_id = $1 AND status = $2',
      [stall_id, 'active']
    );

    if (stallResult.rows.length === 0) {
      return res.status(404).json({ message: 'Stall not found or inactive' });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Add to stock_distribution table
      await pool.query(
        'INSERT INTO stock_distribution (item_id, stall_id, quantity_allocated, distributed_by) VALUES ($1, $2, $3, $4)',
        [id, stall_id, quantity_allocated, req.user.user_id]
      );

      // Update current_stock in items table
      const updatedItem = await pool.query(
        'UPDATE items SET current_stock = current_stock - $1 WHERE item_id = $2 RETURNING *',
        [quantity_allocated, id]
      );

      await pool.query('COMMIT');

      res.json({
        message: 'Stock distributed successfully',
        item: updatedItem.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Distribute stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get categories
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const categoriesResult = await pool.query(
      'SELECT DISTINCT category FROM items ORDER BY category'
    );

    res.json({ categories: categoriesResult.rows.map(row => row.category) });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
