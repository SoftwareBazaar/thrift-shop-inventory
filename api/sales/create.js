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

    // Get user's stall_id
    const stall_id = user.stall_id;
    if (!stall_id) {
      return res.status(400).json({ message: 'User not assigned to a stall' });
    }

    const total_amount = quantity_sold * unit_price;

    // Try to use atomic RPC function first (if database supports it)
    try {
      const { data: result, error: rpcError } = await supabase
        .rpc('create_sale_atomic', {
          p_item_id: item_id,
          p_quantity_sold: quantity_sold,
          p_unit_price: unit_price,
          p_total_amount: total_amount,
          p_stall_id: stall_id,
          p_sale_type: sale_type,
          p_recorded_by: user.user_id,
          p_customer_name: customer_name || null,
          p_customer_contact: customer_contact || null,
          p_due_date: due_date || null,
          p_notes: notes || null,
          p_is_credit: sale_type === 'credit'
        });

      if (!rpcError && result && result.length > 0) {
        // RPC function succeeded
        const sale = result[0];
        return res.status(201).json({
          message: 'Sale recorded successfully',
          sale
        });
      }

      // If RPC fails, fall back to manual transaction
      if (rpcError) {
        console.warn('RPC function not available, using fallback method:', rpcError.message);
      }
    } catch (rpcException) {
      console.warn('RPC call failed, using fallback method:', rpcException.message);
    }

    // FALLBACK: Manual transaction-like approach with validation
    // Check if item exists and has enough stock
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_stock, item_name, buying_price')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.current_stock < quantity_sold) {
      return res.status(400).json({ message: 'Insufficient stock available' });
    }

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
        // Note: Sale is already recorded, credit record is optional
      }
    }

    // Update current_stock (trigger should handle this, but we do it explicitly for reliability)
    const { error: updateError } = await supabase
      .from('items')
      .update({ current_stock: item.current_stock - quantity_sold })
      .eq('item_id', item_id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      // Sale is recorded, stock update failed - this is logged for audit
    }

    res.status(201).json({
      message: 'Sale recorded successfully',
      sale: {
        ...sale,
        buying_price: item.buying_price
      }
    });
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
