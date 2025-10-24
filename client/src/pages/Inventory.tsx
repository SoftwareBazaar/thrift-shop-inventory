import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { useNavigate } from 'react-router-dom';
import { mockApi } from '../services/mockData';

interface Item {
  item_id: number;
  item_name: string;
  category: string;
  initial_stock: number;
  current_stock: number;
  unit_price: number;
  date_added: string;
  sku?: string;
  total_allocated: number;
  total_added: number;
}

interface Stall {
  stall_id: number;
  stall_name: string;
  location: string;
  manager: string;
}

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [selectedStall, setSelectedStall] = useState<number | ''>('');
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [distributionData, setDistributionData] = useState({
    item_id: 0,
    stall_id: '',
    quantity: '',
    notes: ''
  });

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchStalls();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await mockApi.getInventory();
      setItems(response.items);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // Mock categories from inventory data
      const response = await mockApi.getInventory();
      const categories = [...new Set(response.items.map(item => item.category))];
      setCategories(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStalls = async () => {
    try {
      const response = await mockApi.getStalls();
      setStalls(response.stalls);
    } catch (error) {
      console.error('Error fetching stalls:', error);
    }
  };

  // Distribution functionality is handled by the modal

  const handleDistributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await axios.post('/api/inventory/distribute', {
        item_id: distributionData.item_id,
        stall_id: parseInt(distributionData.stall_id),
        quantity: parseInt(distributionData.quantity),
        notes: distributionData.notes
      });
      
      setShowDistributeModal(false);
      fetchItems(); // Refresh items
      alert('Stock distributed successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to distribute stock');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesLowStock = !showLowStock || item.current_stock <= 5;
    
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getStockStatus = (currentStock: number) => {
    if (currentStock === 0) return { text: 'Out of Stock', color: 'text-red-600' };
    if (currentStock <= 5) return { text: 'Low Stock', color: 'text-yellow-600' };
    return { text: 'In Stock', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold" style={{color: 'var(--primary-800)'}}>Inventory Management</h1>
            <p style={{color: 'var(--neutral-600)'}}>Manage your inventory items and stock</p>
          </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/add-item')}
            className="btn-primary"
          >
            Add New Item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stall</label>
            <select
              value={selectedStall}
              onChange={(e) => setSelectedStall(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stalls</option>
              {stalls.map(stall => (
                <option key={stall.stall_id} value={stall.stall_id}>{stall.stall_name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showLowStock}
                onChange={(e) => setShowLowStock(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Show Low Stock Only</span>
            </label>
          </div>
          
          <div className="flex items-end">
            <span className="text-sm text-gray-600">
              Showing {filteredItems.length} of {items.length} items
            </span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(item.current_stock);
                return (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                        {item.sku && (
                          <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.current_stock}</div>
                      <div className="text-xs text-gray-500">
                        Initial: {item.initial_stock} | Added: {item.total_added}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.current_stock * item.unit_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${stockStatus.color}`}>
                        {stockStatus.text}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDistributeModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Distribute
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement add stock functionality
                            console.log('Add stock for item:', item.item_id);
                          }}
                          className="text-green-600 hover:text-green-900"
                        >
                          Add Stock
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
          <p className="text-gray-600">
            {searchTerm || selectedCategory || showLowStock 
              ? 'Try adjusting your filters' 
              : 'Get started by adding your first item'
            }
          </p>
        </div>
      )}

      {/* Stock Distribution Modal */}
      {showDistributeModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Distribute Stock - {selectedItem.item_name}
            </h3>
            <form onSubmit={handleDistributionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Stock: {selectedItem.current_stock}
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Stall</label>
                <select
                  value={distributionData.stall_id}
                  onChange={(e) => setDistributionData(prev => ({ ...prev, stall_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a stall --</option>
                  {stalls.map(stall => (
                    <option key={stall.stall_id} value={stall.stall_id}>
                      {stall.stall_name} ({stall.manager})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Distribute</label>
                <input
                  type="number"
                  value={distributionData.quantity}
                  onChange={(e) => setDistributionData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max={selectedItem.current_stock}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={distributionData.notes}
                  onChange={(e) => setDistributionData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add distribution notes..."
                />
              </div>

              {/* AI Automation Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">🤖 AI Stock Optimization</h4>
                <p className="text-xs text-blue-700">
                  AI suggests optimal distribution based on sales history and demand patterns.
                </p>
                <div className="mt-2 text-xs text-blue-600">
                  💡 Recommended: Distribute 60% to Chuka Town, 40% to Ndagani
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDistributeModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Distribute Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
