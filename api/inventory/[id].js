const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const { id } = req.query;

    if (req.method === 'GET') {
      // Get single item
      const { data: item, error } = await supabase
        .from('items')
        .select(`
          *,
          stock_distribution(
            *,
            stalls(stall_name),
            users(full_name)
          ),
          stock_additions(*)
        `)
        .eq('item_id', id)
        .single();

      if (error || !item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      const total_allocated = item.stock_distribution?.reduce((sum, sd) => sum + (sd.quantity_allocated || 0), 0) || 0;
      const total_added = item.stock_additions?.reduce((sum, sa) => sum + (sa.quantity_added || 0), 0) || 0;

      res.json({
        item: {
          ...item,
          total_allocated,
          total_added
        },
        distribution: item.stock_distribution || []
      });
    } else if (req.method === 'PUT') {
      // Update item (Admin only)
      const adminError = requireAdmin(authResult.user);
      if (adminError) {
        return res.status(adminError.error.status).json({ message: adminError.error.message });
      }

      const { item_name, category, unit_price, sku } = req.body;

      const updateData = {};
      if (item_name !== undefined) updateData.item_name = item_name;
      if (category !== undefined) updateData.category = category;
      if (unit_price !== undefined) updateData.unit_price = unit_price;
      if (sku !== undefined) updateData.sku = sku;

      const { data: updatedItem, error } = await supabase
        .from('items')
        .update(updateData)
        .eq('item_id', id)
        .select()
        .single();

      if (error) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.json({
        message: 'Item updated successfully',
        item: updatedItem
      });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Item operation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

