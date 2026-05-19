// API Route: /api/reconciliation
// Purpose: Stock and allocation reconciliation tools
// Protected: Admin only

const router = require('express').Router();
const db = require('../db');
const { adminOnly } = require('../middleware');

// Check stock reconciliation
router.get('/stock', adminOnly, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM stock_reconciliation
            WHERE variance != 0
            ORDER BY variance DESC
        `);
        
        const hasDiscrepancies = result.rows.some(r => r.variance !== 0);
        
        res.json({
            success: true,
            data: result.rows,
            hasDiscrepancies,
            totalVariance: result.rows.reduce((sum, r) => sum + (r.variance || 0), 0)
        });
    } catch (error) {
        console.error('Error fetching stock reconciliation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check allocation variance
router.get('/allocation-variance', adminOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM check_allocation_variance() ORDER BY status DESC');
        
        const overAllocated = result.rows.filter(r => r.status === 'OVER_ALLOCATED');
        
        res.json({
            success: true,
            data: result.rows,
            summary: {
                totalItems: result.rows.length,
                overAllocated: overAllocated.length,
                fullyAllocated: result.rows.filter(r => r.status === 'FULLY_ALLOCATED').length,
                normal: result.rows.filter(r => r.status === 'NORMAL').length
            },
            hasIssues: overAllocated.length > 0
        });
    } catch (error) {
        console.error('Error checking allocation variance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check for expired stock
router.get('/expired-stock', adminOnly, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM expired_stock
            WHERE expiration_status IN ('EXPIRED', 'EXPIRING_SOON')
            ORDER BY expiration_date ASC
        `);
        
        res.json({
            success: true,
            data: result.rows,
            summary: {
                expired: result.rows.filter(r => r.expiration_status === 'EXPIRED').length,
                expiringSoon: result.rows.filter(r => r.expiration_status === 'EXPIRING_SOON').length
            }
        });
    } catch (error) {
        console.error('Error checking expired stock:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get batch inventory
router.get('/batch-inventory', adminOnly, async (req, res) => {
    try {
        const { itemId } = req.query;
        
        let query = 'SELECT * FROM batch_inventory';
        const params = [];
        
        if (itemId) {
            query += ' WHERE item_id = $1';
            params.push(itemId);
        }
        
        query += ' ORDER BY added_date DESC';
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching batch inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate reconciliation report
router.get('/report', adminOnly, async (req, res) => {
    try {
        // Get stock reconciliation
        const stockResult = await db.query('SELECT * FROM stock_reconciliation');
        
        // Get allocation variance
        const allocationResult = await db.query('SELECT * FROM check_allocation_variance()');
        
        // Get expired stock
        const expiredResult = await db.query(`
            SELECT * FROM expired_stock
            WHERE expiration_status IN ('EXPIRED', 'EXPIRING_SOON')
        `);
        
        // Get pending payments
        const paymentsResult = await db.query(`
            SELECT 
                COUNT(*) as total_pending,
                SUM(balance_due) as total_outstanding
            FROM pending_payments
        `);
        
        res.json({
            success: true,
            data: {
                generatedAt: new Date(),
                stockReconciliation: {
                    items: stockResult.rows,
                    itemsWithVariance: stockResult.rows.filter(r => r.variance !== 0).length,
                    totalVariance: stockResult.rows.reduce((sum, r) => sum + (r.variance || 0), 0)
                },
                allocationVariance: {
                    items: allocationResult.rows,
                    overAllocated: allocationResult.rows.filter(r => r.status === 'OVER_ALLOCATED').length,
                    fullyAllocated: allocationResult.rows.filter(r => r.status === 'FULLY_ALLOCATED').length
                },
                expiredStock: {
                    items: expiredResult.rows,
                    expiredCount: expiredResult.rows.filter(r => r.expiration_status === 'EXPIRED').length,
                    expiringSoonCount: expiredResult.rows.filter(r => r.expiration_status === 'EXPIRING_SOON').length
                },
                outstandingPayments: {
                    totalPending: parseInt(paymentsResult.rows[0].total_pending) || 0,
                    totalAmount: parseFloat(paymentsResult.rows[0].total_outstanding) || 0
                }
            }
        });
    } catch (error) {
        console.error('Error generating reconciliation report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fix over-allocation by manual adjustment
router.post('/fix-over-allocation/:itemId', adminOnly, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { action } = req.body; // 'adjust-stock' or 'reduce-allocation'
        
        if (!action) {
            return res.status(400).json({ success: false, error: 'Action required' });
        }
        
        // This endpoint would allow admins to fix over-allocations
        // Implementation depends on business rules
        
        res.json({
            success: true,
            message: `Over-allocation resolution initiated for item ${itemId}`,
            action
        });
    } catch (error) {
        console.error('Error fixing over-allocation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
