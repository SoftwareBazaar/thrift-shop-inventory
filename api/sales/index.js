const supabase = require('../../lib/supabase');
const { authenticateToken } = require('../_middleware');

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
      start_date,
      end_date,
      sale_type,
      stall_id
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('sales')
      .select(`
        *,
        items(item_name, category),
        stalls(stall_name),
        users!sales_recorded_by_fkey(full_name),
        credit_sales(*)
      `)
      .order('date_time', { ascending: false });

    // If user is not admin, only show their stall's sales
    if (user.role === 'user' && user.stall_id) {
      query = query.eq('stall_id', user.stall_id);
    } else if (user.role === 'admin' && stall_id) {
      query = query.eq('stall_id', stall_id);
    }

    // Filter by date range
    if (start_date) {
      query = query.gte('date_time', start_date);
    }
    if (end_date) {
      query = query.lte('date_time', end_date);
    }

    // Filter by sale type
    if (sale_type) {
      query = query.eq('sale_type', sale_type);
    }

    const { data: sales, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Get sales error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Transform sales data
    const transformedSales = sales.map(sale => ({
      ...sale,
      item_name: sale.items?.item_name,
      category: sale.items?.category,
      stall_name: sale.stalls?.stall_name,
      recorded_by_name: sale.users?.full_name,
      customer_name: sale.credit_sales?.[0]?.customer_name,
      customer_contact: sale.credit_sales?.[0]?.customer_contact,
      payment_status: sale.credit_sales?.[0]?.payment_status,
      balance_due: sale.credit_sales?.[0]?.balance_due
    }));

    res.json({
      sales: transformedSales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: transformedSales.length,
        pages: Math.ceil(transformedSales.length / limit)
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

