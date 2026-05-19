// API Route: /api/audit/logs
// Purpose: View and filter audit trail logs
// Protected: Admin only

const router = require('express').Router();
const db = require('../db');
const { adminOnly } = require('../middleware');

// Get audit logs with filtering
router.get('/logs', adminOnly, async (req, res) => {
    try {
        const { userId, action, table, startDate, endDate, limit = 100, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM activity_log WHERE 1=1';
        const params = [];
        
        if (userId) {
            query += ` AND user_id = $${params.length + 1}`;
            params.push(userId);
        }
        
        if (action) {
            query += ` AND action = $${params.length + 1}`;
            params.push(action.toUpperCase());
        }
        
        if (table) {
            query += ` AND table_name = $${params.length + 1}`;
            params.push(table);
        }
        
        if (startDate) {
            query += ` AND timestamp >= $${params.length + 1}`;
            params.push(new Date(startDate));
        }
        
        if (endDate) {
            query += ` AND timestamp <= $${params.length + 1}`;
            params.push(new Date(endDate));
        }
        
        query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent activity (last 500 records)
router.get('/recent', adminOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM recent_activity LIMIT 100');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check for orphaned records
router.get('/orphaned-records', adminOnly, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orphaned_records');
        res.json({
            success: true,
            data: result.rows,
            hasIssues: result.rows.length > 0
        });
    } catch (error) {
        console.error('Error checking orphaned records:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user activity summary
router.get('/user-activity/:userId', adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const { days = 30 } = req.query;
        
        const result = await db.query(`
            SELECT 
                action,
                COUNT(*) as count,
                MAX(timestamp) as last_action
            FROM activity_log
            WHERE user_id = $1
                AND timestamp >= NOW() - INTERVAL '${days} days'
            GROUP BY action
            ORDER BY count DESC
        `, [userId]);
        
        res.json({
            success: true,
            userId,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
