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

    const { data: items, error } = await supabase
      .from('items')
      .select('category');

    if (error) {
      return res.status(500).json({ message: 'Internal server error' });
    }

    // Get unique categories
    const categories = [...new Set(items.map(item => item.category))].sort();

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

