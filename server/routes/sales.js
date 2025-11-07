const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Record a sale
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      item_id, 
      quantity_sold, 
      unit_price, 
      sale_type, 
      customer_name, 
      customer_contact,
      due_date,
      notes 
    } = req.body;

    // Validate required fields
    if (!item_id || !quantity_sold || !unit_price || !sale_type) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Validate sale type
    if (!['cash', 'credit', 'mobile', 'split'].includes(sale_type)) {
      return res.status(400).json({ message: 'Invalid sale type' });
    }
    
    // For split payments, validate cash_amount and mobile_amount
    let cash_amount = null;
    let mobile_amount = null;
    if (sale_type === 'split') {
      cash_amount = req.body.cash_amount || null;
      mobile_amount = req.body.mobile_amount || null;
      if (!cash_amount || !mobile_amount || cash_amount <= 0 || mobile_amount <= 0) {
        return res.status(400).json({ message: 'Both cash_amount and mobile_amount are required for split payments' });
      }
      if (Math.abs((cash_amount + mobile_amount) - (quantity_sold * unit_price)) > 0.01) {
        return res.status(400).json({ message: 'Cash and mobile amounts must equal total amount' });
      }
    }

    // For credit sales, customer details are required
    if (sale_type === 'credit' && (!customer_name || !customer_contact)) {
      return res.status(400).json({ message: 'Customer details required for credit sales' });
    }

    // Check if item exists and has enough stock
    const itemResult = await pool.query(
      'SELECT current_stock, item_name FROM items WHERE item_id = $1',
      [item_id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (itemResult.rows[0].current_stock < quantity_sold) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

    // Get stall_id from request body (admin can select any stall), or use user's stall_id
    let stall_id = req.body.stall_id;
    if (!stall_id) {
      // If no stall_id provided, try to use user's assigned stall
      stall_id = req.user.stall_id;
    }
    
    // If still no stall_id, return error
    if (!stall_id) {
      return res.status(400).json({ message: 'Stall ID is required. Please select a stall.' });
    }
    
    // Validate that stall exists
    const stallCheck = await pool.query(
      'SELECT stall_id FROM stalls WHERE stall_id = $1 AND status = $2',
      [stall_id, 'active']
    );
    
    if (stallCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Stall not found or inactive' });
    }

    const total_amount = quantity_sold * unit_price;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Insert sale record
      const saleResult = await pool.query(
        `INSERT INTO sales (item_id, stall_id, quantity_sold, unit_price, total_amount, sale_type, cash_amount, mobile_amount, recorded_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [item_id, stall_id, quantity_sold, unit_price, total_amount, sale_type, cash_amount, mobile_amount, req.user.user_id]
      );

      // If credit sale, create credit record
      if (sale_type === 'credit') {
        await pool.query(
          `INSERT INTO credit_sales (sale_id, customer_name, customer_contact, total_credit_amount, due_date, notes) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [saleResult.rows[0].sale_id, customer_name, customer_contact, total_amount, due_date, notes]
        );
      }

      await pool.query('COMMIT');

      res.status(201).json({
        message: 'Sale recorded successfully',
        sale: saleResult.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get sales with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      start_date, 
      end_date, 
      sale_type,
      stall_id 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // If user is not admin, only show their stall's sales
    if (req.user.role === 'user' && req.user.stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    } else if (req.user.role === 'admin' && stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(stall_id);
      paramIndex++;
    }

    // Filter by date range
    if (start_date) {
      whereClause += ` AND s.date_time >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClause += ` AND s.date_time <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    // Filter by sale type
    if (sale_type) {
      whereClause += ` AND s.sale_type = $${paramIndex}`;
      queryParams.push(sale_type);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM sales s ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalSales = parseInt(countResult.rows[0].count);

    // Get sales with item and stall details
    const salesQuery = `
      SELECT 
        s.*,
        i.item_name,
        i.category,
        st.stall_name,
        u.full_name as recorded_by_name,
        cs.customer_name,
        cs.customer_contact,
        cs.payment_status,
        cs.balance_due,
        cs.amount_paid,
        cs.due_date,
        cs.notes
      FROM sales s
      JOIN items i ON s.item_id = i.item_id
      JOIN stalls st ON s.stall_id = st.stall_id
      JOIN users u ON s.recorded_by = u.user_id
      LEFT JOIN credit_sales cs ON s.sale_id = cs.sale_id
      ${whereClause}
      ORDER BY s.date_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const salesResult = await pool.query(salesQuery, queryParams);

    res.json({
      sales: salesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalSales,
        pages: Math.ceil(totalSales / limit)
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update sale (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    item_id,
    stall_id,
    quantity_sold,
    unit_price,
    sale_type,
    cash_amount,
    mobile_amount,
    customer_name,
    customer_contact,
    due_date,
    notes
  } = req.body;

  try {
    if (!item_id || !stall_id || !quantity_sold || !unit_price || !sale_type) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    if (!['cash', 'credit', 'mobile', 'split'].includes(sale_type)) {
      return res.status(400).json({ message: 'Invalid sale type' });
    }

    const newItemId = Number(item_id);
    const newStallId = Number(stall_id);
    const newQuantity = Number(quantity_sold);
    const newUnitPrice = Number(unit_price);

    if ([newItemId, newStallId, newQuantity, newUnitPrice].some((value) => Number.isNaN(value))) {
      return res.status(400).json({ message: 'Invalid numeric values provided' });
    }

    const saleResult = await pool.query(
      `SELECT s.*, cs.credit_id, cs.customer_name AS credit_customer_name, cs.customer_contact AS credit_customer_contact,
              cs.total_credit_amount, cs.amount_paid, cs.payment_status, cs.due_date AS credit_due_date, cs.notes AS credit_notes
       FROM sales s
       LEFT JOIN credit_sales cs ON s.sale_id = cs.sale_id
       WHERE s.sale_id = $1`,
      [id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const existingSale = saleResult.rows[0];

    // Validate stalls
    const stallCheck = await pool.query(
      'SELECT stall_id FROM stalls WHERE stall_id = $1 AND status = $2',
      [newStallId, 'active']
    );

    if (stallCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Stall not found or inactive' });
    }

    // Validate split amounts
    let newCashAmount = null;
    let newMobileAmount = null;
    if (sale_type === 'split') {
      if (!cash_amount || !mobile_amount) {
        return res.status(400).json({ message: 'Cash and mobile amounts required for split sales' });
      }
      newCashAmount = Number(cash_amount);
      newMobileAmount = Number(mobile_amount);
      if (newCashAmount <= 0 || newMobileAmount <= 0) {
        return res.status(400).json({ message: 'Split amounts must be greater than zero' });
      }
      const totalCheck = Number(quantity_sold) * Number(unit_price);
      if (Math.abs((newCashAmount + newMobileAmount) - totalCheck) > 0.01) {
        return res.status(400).json({ message: 'Split amounts must equal total amount' });
      }
    }

    if (sale_type === 'credit' && (!customer_name || !customer_contact)) {
      return res.status(400).json({ message: 'Customer details are required for credit sales' });
    }

    const totalAmount = newQuantity * newUnitPrice;

    await pool.query('BEGIN');

    try {
      // Stock adjustments
      if (newItemId !== Number(existingSale.item_id)) {
        // Return stock to previous item
        await pool.query(
          'UPDATE items SET current_stock = current_stock + $1 WHERE item_id = $2',
          [existingSale.quantity_sold, existingSale.item_id]
        );

        const newItemResult = await pool.query(
          'SELECT current_stock FROM items WHERE item_id = $1',
          [newItemId]
        );

        if (newItemResult.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ message: 'Selected item not found' });
        }

        if (newItemResult.rows[0].current_stock < newQuantity) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ message: 'Insufficient stock available for selected item' });
        }

        await pool.query(
          'UPDATE items SET current_stock = current_stock - $1 WHERE item_id = $2',
          [newQuantity, newItemId]
        );
      } else if (newQuantity !== existingSale.quantity_sold) {
        const quantityDifference = newQuantity - existingSale.quantity_sold;
        if (quantityDifference > 0) {
          const stockResult = await pool.query(
            'SELECT current_stock FROM items WHERE item_id = $1',
            [newItemId]
          );

          if (stockResult.rows.length === 0 || stockResult.rows[0].current_stock < quantityDifference) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Insufficient stock available for the new quantity' });
          }

          await pool.query(
            'UPDATE items SET current_stock = current_stock - $1 WHERE item_id = $2',
            [quantityDifference, newItemId]
          );
        } else if (quantityDifference < 0) {
          await pool.query(
            'UPDATE items SET current_stock = current_stock + $1 WHERE item_id = $2',
            [Math.abs(quantityDifference), newItemId]
          );
        }
      }

      const updatedSaleResult = await pool.query(
        `UPDATE sales 
         SET item_id = $1,
             stall_id = $2,
             quantity_sold = $3,
             unit_price = $4,
             total_amount = $5,
             sale_type = $6,
             cash_amount = $7,
             mobile_amount = $8
         WHERE sale_id = $9
         RETURNING *`,
        [
          newItemId,
          newStallId,
          newQuantity,
          newUnitPrice,
          totalAmount,
          sale_type,
          newCashAmount,
          newMobileAmount,
          id
        ]
      );

      if (sale_type === 'credit') {
        if (existingSale.credit_id) {
          // Update existing credit record but keep amount_paid as-is
          await pool.query(
            `UPDATE credit_sales 
             SET customer_name = $1,
                 customer_contact = $2,
                 total_credit_amount = $3,
                 due_date = $4,
                 notes = $5
             WHERE credit_id = $6`,
            [
              customer_name,
              customer_contact,
              totalAmount,
              due_date || null,
              notes !== undefined ? notes : existingSale.credit_notes,
              existingSale.credit_id
            ]
          );
        } else {
          await pool.query(
            `INSERT INTO credit_sales (sale_id, customer_name, customer_contact, total_credit_amount, due_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, customer_name, customer_contact, totalAmount, due_date || null, notes || null]
          );
        }
      } else if (existingSale.credit_id) {
        await pool.query('DELETE FROM credit_sales WHERE sale_id = $1', [id]);
      }

      await pool.query('COMMIT');

      res.json({
        message: 'Sale updated successfully',
        sale: updatedSaleResult.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get credit sales (Admin only)
router.get('/credit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      payment_status,
      stall_id 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by payment status
    if (payment_status) {
      whereClause += ` AND cs.payment_status = $${paramIndex}`;
      queryParams.push(payment_status);
      paramIndex++;
    }

    // Filter by stall
    if (stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(stall_id);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM credit_sales cs
      JOIN sales s ON cs.sale_id = s.sale_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCredits = parseInt(countResult.rows[0].count);

    // Get credit sales
    const creditsQuery = `
      SELECT 
        cs.*,
        s.quantity_sold,
        s.unit_price,
        s.date_time as sale_date,
        i.item_name,
        i.category,
        st.stall_name,
        u.full_name as recorded_by_name
      FROM credit_sales cs
      JOIN sales s ON cs.sale_id = s.sale_id
      JOIN items i ON s.item_id = i.item_id
      JOIN stalls st ON s.stall_id = st.stall_id
      JOIN users u ON s.recorded_by = u.user_id
      ${whereClause}
      ORDER BY cs.created_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const creditsResult = await pool.query(creditsQuery, queryParams);

    res.json({
      credit_sales: creditsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCredits,
        pages: Math.ceil(totalCredits / limit)
      }
    });
  } catch (error) {
    console.error('Get credit sales error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update credit payment
router.put('/credit/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount_paid, payment_status, notes } = req.body;

    if (amount_paid === undefined || amount_paid < 0) {
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    // Get current credit record
    const creditResult = await pool.query(
      'SELECT * FROM credit_sales WHERE credit_id = $1',
      [id]
    );

    if (creditResult.rows.length === 0) {
      return res.status(404).json({ message: 'Credit record not found' });
    }

    const currentCredit = creditResult.rows[0];
    const newAmountPaid = currentCredit.amount_paid + amount_paid;
    const newBalance = currentCredit.total_credit_amount - newAmountPaid;

    // Determine payment status
    let newPaymentStatus = payment_status;
    if (!newPaymentStatus) {
      if (newBalance <= 0) {
        newPaymentStatus = 'fully_paid';
      } else if (newAmountPaid > 0) {
        newPaymentStatus = 'partially_paid';
      } else {
        newPaymentStatus = 'unpaid';
      }
    }

    // Update credit record
    const updateResult = await pool.query(
      `UPDATE credit_sales 
       SET amount_paid = $1, payment_status = $2, notes = COALESCE($3, notes)
       WHERE credit_id = $4 
       RETURNING *`,
      [newAmountPaid, newPaymentStatus, notes, id]
    );

    res.json({
      message: 'Payment updated successfully',
      credit_sale: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Update credit payment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get sales summary/dashboard data
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { period = 'today', stall_id } = req.query;
    
    let dateFilter = '';
    const queryParams = [];
    let paramIndex = 1;

    // Set date filter based on period
    switch (period) {
      case 'today':
        dateFilter = "AND s.date_time >= CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "AND s.date_time >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "AND s.date_time >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "AND s.date_time >= CURRENT_DATE - INTERVAL '365 days'";
        break;
    }

    // Filter by stall if specified (admin only) or user's stall
    let stallFilter = '';
    if (req.user.role === 'admin' && stall_id) {
      stallFilter = `AND s.stall_id = $${paramIndex}`;
      queryParams.push(stall_id);
      paramIndex++;
    } else if (req.user.role === 'user' && req.user.stall_id) {
      stallFilter = `AND s.stall_id = $${paramIndex}`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    }

    // Get sales summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        SUM(quantity_sold) as total_units_sold,
        AVG(total_amount) as average_sale_value,
        COUNT(CASE WHEN sale_type = 'cash' THEN 1 END) as cash_sales,
        COUNT(CASE WHEN sale_type = 'credit' THEN 1 END) as credit_sales,
        SUM(CASE WHEN sale_type = 'cash' THEN total_amount ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN sale_type = 'credit' THEN total_amount ELSE 0 END) as credit_revenue
      FROM sales s
      WHERE 1=1 ${dateFilter} ${stallFilter}
    `;

    const summaryResult = await pool.query(summaryQuery, queryParams);

    // Get top selling items
    const topItemsQuery = `
      SELECT 
        i.item_name,
        i.category,
        SUM(s.quantity_sold) as total_quantity,
        SUM(s.total_amount) as total_revenue,
        COUNT(s.sale_id) as sale_count
      FROM sales s
      JOIN items i ON s.item_id = i.item_id
      WHERE 1=1 ${dateFilter} ${stallFilter}
      GROUP BY i.item_id, i.item_name, i.category
      ORDER BY total_quantity DESC
      LIMIT 10
    `;

    const topItemsResult = await pool.query(topItemsQuery, queryParams);

    res.json({
      summary: summaryResult.rows[0],
      top_items: topItemsResult.rows
    });
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
