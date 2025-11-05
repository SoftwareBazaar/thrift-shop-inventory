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

    const {
      item_name,
      category,
      initial_stock,
      unit_price,
      sku
    } = req.body;

    // Validate required fields
    if (!item_name || !category || !initial_stock || !unit_price) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if SKU already exists
    if (sku) {
      const { data: existingSku } = await supabase
        .from('items')
        .select('item_id')
        .eq('sku', sku)
        .single();

      if (existingSku) {
        return res.status(400).json({ message: 'SKU already exists' });
      }
    }

    // Insert new item
    const { data: newItem, error } = await supabase
      .from('items')
      .insert([
        {
          item_name,
          category,
          initial_stock,
          current_stock: initial_stock,
          unit_price,
          sku: sku || null,
          created_by: authResult.user.user_id
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Create item error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    res.status(201).json({
      message: 'Item created successfully',
      item: newItem
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

