// API Route: /api/inventory/withdrawals
// Purpose: Track stock withdrawals with reasons
// Protected: Admin only

const router = require('express').Router();
const db = require('../db');
const { adminOnly } = require('../middleware');

// Record a stock withdrawal
router.post('/', adminOnly, async (req, res) => {
    try {
        const { itemId, quantityWithdrawn, reason, notes, batchNumber } = req.body;
        
        // Validate inputs
        if (!itemId || !quantityWithdrawn || quantityWithdrawn <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid item or quantity' });
        }
        
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ success: false, error: 'Withdrawal reason is required' });
        }
        
        // Check if item has enough stock
        const itemResult = await db.query(
            'SELECT current_stock FROM items WHERE item_id = $1',
            [itemId]
        );
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        
        if (itemResult.rows[0].current_stock < quantityWithdrawn) {
            return res.status(400).json({
                success: false,
                error: `Insufficient stock. Available: ${itemResult.rows[0].current_stock}`
            });
        }
        
        // Start transaction
        await db.query('BEGIN');
        
        // Record withdrawal
        const result = await db.query(`
            INSERT INTO stock_withdrawals 
            (item_id, quantity_withdrawn, reason, withdrawn_by, notes, batch_number)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [itemId, quantityWithdrawn, reason, req.user.user_id, notes || null, batchNumber || null]);
        
        // Update item stock
        await db.query(
            'UPDATE items SET current_stock = current_stock - $1 WHERE item_id = $2',
            [quantityWithdrawn, itemId]
        );
        
        // Log to activity log
        await db.query(`
            INSERT INTO activity_log (user_id, action, table_name, record_id, new_values)
            VALUES ($1, 'WITHDRAWAL', 'stock_withdrawals', $2, $3)
        `, [req.user.user_id, result.rows[0].withdrawal_id, JSON.stringify(result.rows[0])]);
        
        await db.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Stock withdrawal recorded successfully',
            data: result.rows[0]
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error recording withdrawal:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get withdrawal history
router.get('/history', adminOnly, async (req, res) => {
    try {
        const { itemId, startDate, endDate, limit = 100 } = req.query;
        
        let query = `
            SELECT 
                sw.*,
                i.item_name,
                u.username as withdrawn_by_user
            FROM stock_withdrawals sw
            LEFT JOIN items i ON sw.item_id = i.item_id
            LEFT JOIN users u ON sw.withdrawn_by = u.user_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (itemId) {
            query += ` AND sw.item_id = $${params.length + 1}`;
            params.push(itemId);
        }
        
        if (startDate) {
            query += ` AND sw.withdrawal_date >= $${params.length + 1}`;
            params.push(new Date(startDate));
        }
        
        if (endDate) {
            query += ` AND sw.withdrawal_date <= $${params.length + 1}`;
            params.push(new Date(endDate));
        }
        
        query += ` ORDER BY sw.withdrawal_date DESC LIMIT ${limit}`;
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching withdrawal history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get withdrawal reasons report
router.get('/report/reasons', adminOnly, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                reason,
                COUNT(*) as count,
                SUM(quantity_withdrawn) as total_quantity
            FROM stock_withdrawals
            GROUP BY reason
            ORDER BY count DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching withdrawal reasons report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get withdrawal by reason category
router.get('/by-reason/:reason', adminOnly, async (req, res) => {
    try {
        const { reason } = req.params;
        
        const result = await db.query(`
            SELECT 
                sw.*,
                i.item_name,
                u.username as withdrawn_by_user
            FROM stock_withdrawals sw
            LEFT JOIN items i ON sw.item_id = i.item_id
            LEFT JOIN users u ON sw.withdrawn_by = u.user_id
            WHERE sw.reason = $1
            ORDER BY sw.withdrawal_date DESC
        `, [reason]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching withdrawals by reason:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
