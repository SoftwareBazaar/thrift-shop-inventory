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

    const user = authResult.user;
    const {
      item_id,
      quantity_sold,
      unit_price,
      sale_type,
      customer_name,
      customer_contact,
      due_date,
      notes
    } = req.body;

    // Validate required fields
    if (!item_id || !quantity_sold || !unit_price || !sale_type) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Validate sale type
    if (!['cash', 'credit'].includes(sale_type)) {
      return res.status(400).json({ message: 'Invalid sale type' });
    }

    // For credit sales, customer details are required
    if (sale_type === 'credit' && (!customer_name || !customer_contact)) {
      return res.status(400).json({ message: 'Customer details required for credit sales' });
    }

    // Check if item exists and has enough stock
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_stock, item_name')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.current_stock < quantity_sold) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

    // Get user's stall_id
    const stall_id = user.stall_id;
    if (!stall_id) {
      return res.status(400).json({ message: 'User not assigned to a stall' });
    }

    const total_amount = quantity_sold * unit_price;

    // Insert sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        item_id,
        stall_id,
        quantity_sold,
        unit_price,
        total_amount,
        sale_type,
        recorded_by: user.user_id
      }])
      .select()
      .single();

    if (saleError) {
      console.error('Sale creation error:', saleError);
      return res.status(500).json({ message: 'Internal server error' });
    }

    // If credit sale, create credit record
    if (sale_type === 'credit') {
      const { error: creditError } = await supabase
        .from('credit_sales')
        .insert([{
          sale_id: sale.sale_id,
          customer_name,
          customer_contact,
          total_credit_amount: total_amount,
          due_date: due_date || null,
          notes: notes || null
        }]);

      if (creditError) {
        console.error('Credit sale creation error:', creditError);
        // Note: In production, you might want to rollback the sale here
      }
    }

    // Update item stock (trigger should handle this, but we'll do it explicitly)
    await supabase
      .from('items')
      .update({ current_stock: item.current_stock - quantity_sold })
      .eq('item_id', item_id);

    res.status(201).json({
      message: 'Sale recorded successfully',
      sale
    });
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

