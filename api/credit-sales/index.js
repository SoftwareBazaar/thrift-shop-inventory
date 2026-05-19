// API Route: /api/credit-sales
// Purpose: Manage credit sales and payment tracking
// Protected: Admin/User

const router = require('express').Router();
const db = require('../db');
const { requireAuth, adminOnly } = require('../middleware');

// Get all pending payments
router.get('/pending', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM pending_payments
            ORDER BY due_date ASC
        `);
        
        res.json({
            success: true,
            data: result.rows,
            totalCount: result.rows.length,
            totalDue: result.rows.reduce((sum, p) => sum + parseFloat(p.balance_due || 0), 0)
        });
    } catch (error) {
        console.error('Error fetching pending payments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment history for a credit sale
router.get('/:creditId/payments', requireAuth, async (req, res) => {
    try {
        const { creditId } = req.params;
        
        const result = await db.query(`
            SELECT 
                ph.*,
                u.username as recorded_by_user
            FROM payment_history ph
            LEFT JOIN users u ON ph.recorded_by = u.user_id
            WHERE ph.credit_id = $1
            ORDER BY ph.payment_date DESC
        `, [creditId]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Record a payment
router.post('/:creditId/payment', requireAuth, async (req, res) => {
    try {
        const { creditId } = req.params;
        const { paymentAmount, paymentMethod, notes } = req.body;
        
        if (!paymentAmount || paymentAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid payment amount' });
        }
        
        // Start transaction
        await db.query('BEGIN');
        
        // Get current credit info
        const creditResult = await db.query(
            'SELECT * FROM credit_sales WHERE credit_id = $1',
            [creditId]
        );
        
        if (creditResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Credit sale not found' });
        }
        
        const creditSale = creditResult.rows[0];
        const newBalance = parseFloat(creditSale.amount_paid || 0) + parseFloat(paymentAmount);
        
        // Insert payment record
        const paymentResult = await db.query(`
            INSERT INTO payment_history 
            (credit_id, payment_amount, payment_method, recorded_by, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [creditId, paymentAmount, paymentMethod || 'cash', req.user.user_id, notes]);
        
        // Update credit_sales amount_paid
        await db.query(
            'UPDATE credit_sales SET amount_paid = $1 WHERE credit_id = $2',
            [newBalance, creditId]
        );
        
        // Commit transaction
        await db.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Payment recorded successfully',
            data: paymentResult.rows[0]
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error recording payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment urgency report
router.get('/report/urgency', adminOnly, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                payment_urgency,
                COUNT(*) as count,
                SUM(balance_due) as total_balance
            FROM pending_payments
            GROUP BY payment_urgency
            ORDER BY 
                CASE payment_urgency 
                    WHEN 'OVERDUE' THEN 1
                    WHEN 'DUE SOON' THEN 2
                    WHEN 'OK' THEN 3
                END
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching payment urgency report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get customer payment history
router.get('/customer/:customerId', requireAuth, async (req, res) => {
    try {
        const { customerId } = req.params;
        
        const result = await db.query(`
            SELECT * FROM credit_sales
            WHERE customer_name ILIKE $1
            ORDER BY created_date DESC
        `, [`%${customerId}%`]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching customer history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
