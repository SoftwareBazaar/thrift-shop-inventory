const supabase = require('../../lib/supabase');
const { authenticateToken } = require('../_middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await authenticateToken(req);
    if (authResult.error) {
      return res.status(authResult.error.status).json({ message: authResult.error.message });
    }

    const { id, quantity_added } = req.body;

    if (!id || !quantity_added || quantity_added <= 0) {
      return res.status(400).json({ message: 'Valid item ID and quantity are required' });
    }

    // Check if item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, current_stock')
      .eq('item_id', id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Start transaction by adding stock addition record and updating item
    const { error: additionError } = await supabase
      .from('stock_additions')
      .insert([{
        item_id: id,
        quantity_added,
        added_by: authResult.user.user_id
      }]);

    if (additionError) {
      return res.status(500).json({ message: 'Error adding stock record' });
    }

    // Update current_stock
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({ current_stock: item.current_stock + quantity_added })
      .eq('item_id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ message: 'Error updating stock' });
    }

    res.json({
      message: 'Stock added successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

