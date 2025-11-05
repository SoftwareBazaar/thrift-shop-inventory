const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const user = authResult.user;
    const {
      page = 1,
      limit = 50,
      category,
      search,
      low_stock,
      stall_id
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('items')
      .select(`
        *,
        stock_distribution(quantity_allocated),
        stock_additions(quantity_added)
      `);

    // If user is not admin, only show items from their stall
    if (user.role === 'user' && user.stall_id) {
      query = query.eq('stock_distribution.stall_id', user.stall_id);
    }

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Search by item name
    if (search) {
      query = query.ilike('item_name', `%${search}%`);
    }

    // Filter low stock items
    if (low_stock === 'true') {
      query = query.lte('current_stock', 5);
    }

    // Get total count (simplified - you might need a separate count query)
    const { data: items, error } = await query
      .order('date_added', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Get items error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Process items to calculate totals
    const processedItems = items.map(item => {
      const total_allocated = item.stock_distribution?.reduce((sum, sd) => sum + (sd.quantity_allocated || 0), 0) || 0;
      const total_added = item.stock_additions?.reduce((sum, sa) => sum + (sa.quantity_added || 0), 0) || 0;
      return {
        ...item,
        total_allocated,
        total_added,
        stock_distribution: undefined,
        stock_additions: undefined
      };
    });

    res.json({
      items: processedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: processedItems.length,
        pages: Math.ceil(processedItems.length / limit)
      }
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

