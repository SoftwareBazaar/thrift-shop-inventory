const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const adminError = requireAdmin(authResult.user);
    if (adminError) {
      return res.status(adminError.error.status).json({ message: adminError.error.message });
    }

    const { id, stall_id, quantity_allocated } = req.body;

    if (!id || !stall_id || !quantity_allocated || quantity_allocated <= 0) {
      return res.status(400).json({ message: 'Valid item, stall, and quantity are required' });
    }

    // Check if item exists and has enough stock
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.current_stock < quantity_allocated) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

    // Check if stall exists
    const { data: stall } = await supabase
      .from('stalls')
      .select('stall_id')
      .eq('stall_id', stall_id)
      .eq('status', 'active')
      .single();

    if (!stall) {
      return res.status(404).json({ message: 'Stall not found or inactive' });
    }

    // Add distribution record
    const { error: distError } = await supabase
      .from('stock_distribution')
      .insert([{
        item_id: id,
        stall_id,
        quantity_allocated,
        distributed_by: authResult.user.user_id
      }]);

    if (distError) {
      return res.status(500).json({ message: 'Error creating distribution record' });
    }

    // Update current_stock
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({ current_stock: item.current_stock - quantity_allocated })
      .eq('item_id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ message: 'Error updating stock' });
    }

    res.json({
      message: 'Stock distributed successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Distribute stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

