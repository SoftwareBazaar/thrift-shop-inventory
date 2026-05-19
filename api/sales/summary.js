const supabase = require('../../lib/supabase');
const { authenticateToken } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const user = authResult.user;
    const { period = 'today', stall_id } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    switch (period) {
      case 'today':
        dateFilter = { gte: new Date(now.setHours(0, 0, 0, 0)).toISOString() };
        break;
      case 'week':
        dateFilter = { gte: new Date(now.setDate(now.getDate() - 7)).toISOString() };
        break;
      case 'month':
        dateFilter = { gte: new Date(now.setDate(now.getDate() - 30)).toISOString() };
        break;
      case 'year':
        dateFilter = { gte: new Date(now.setDate(now.getDate() - 365)).toISOString() };
        break;
    }

    // Build query
    let query = supabase.from('sales').select('*');

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      query = query.gte('date_time', dateFilter.gte);
    }

    // Filter by stall
    if (user.role === 'admin' && stall_id) {
      query = query.eq('stall_id', stall_id);
    } else if (user.role === 'user' && user.stall_id) {
      query = query.eq('stall_id', user.stall_id);
    }

    const { data: sales, error } = await query;

    if (error) {
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Calculate summary
    const summary = {
      total_sales: sales.length,
      total_revenue: sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
      total_units_sold: sales.reduce((sum, s) => sum + (s.quantity_sold || 0), 0),
      average_sale_value: sales.length > 0
        ? sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0) / sales.length
        : 0,
      cash_sales: sales.filter(s => s.sale_type === 'cash').length,
      credit_sales: sales.filter(s => s.sale_type === 'credit').length,
      cash_revenue: sales
        .filter(s => s.sale_type === 'cash')
        .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
      credit_revenue: sales
        .filter(s => s.sale_type === 'credit')
        .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0)
    };

    // Get top items (simplified - you might want to use a separate query for better performance)
    const itemCounts = {};
    sales.forEach(sale => {
      if (!itemCounts[sale.item_id]) {
        itemCounts[sale.item_id] = {
          item_id: sale.item_id,
          quantity: 0,
          revenue: 0
        };
      }
      itemCounts[sale.item_id].quantity += sale.quantity_sold || 0;
      itemCounts[sale.item_id].revenue += parseFloat(sale.total_amount || 0);
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Get item names
    if (topItems.length > 0) {
      const itemIds = topItems.map(t => t.item_id);
      const { data: items } = await supabase
        .from('items')
        .select('item_id, item_name, category')
        .in('item_id', itemIds);

      topItems.forEach((topItem, idx) => {
        const item = items?.find(i => i.item_id === topItem.item_id);
        if (item) {
          topItems[idx] = {
            ...topItem,
            item_name: item.item_name,
            category: item.category
          };
        }
      });
    }

    res.json({
      summary,
      top_items: topItems
    });
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

