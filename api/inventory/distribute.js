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
      return res.status(400).json({ message: 'Valid item, stall, and positive quantity are required' });
    }

    // Try to use atomic RPC function first (if database supports it)
    try {
      const { data: result, error: rpcError } = await supabase
        .rpc('distribute_stock_atomic', {
          p_item_id: id,
          p_stall_id: stall_id,
          p_quantity_allocated: quantity_allocated,
          p_distributed_by: authResult.user.user_id
        });

      if (!rpcError && result && result.length > 0) {
        // RPC function succeeded
        const distribution = result[0];
        return res.json({
          message: 'Stock distributed successfully',
          distribution
        });
      }

      // If RPC fails, fall back to manual transaction
      if (rpcError) {
        console.warn('RPC function not available, using fallback method:', rpcError.message);
      }
    } catch (rpcException) {
      console.warn('RPC call failed, using fallback method:', rpcException.message);
    }

    // RPC function is required for atomic distribution
    // Fallback is not safe due to race conditions
    return res.status(503).json({
      message: 'Distribution service temporarily unavailable. Please try again.',
      error: 'RPC function required for atomic operations'
    });
  } catch (error) {
    console.error('Distribute stock error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

