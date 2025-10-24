import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface Stall {
  stall_id: number;
  stall_name: string;
  location: string;
  manager: string;
}

const AddItem: React.FC = () => {
  const navigate = useNavigate();
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    category: '',
    initial_stock: '',
    unit_price: '',
    sku: '',
    description: '',
    selectedStall: ''
  });

  useEffect(() => {
    fetchStalls();
  }, []);

  const fetchStalls = async () => {
    try {
      const response = await axios.get('/api/stalls');
      setStalls(response.data.stalls);
    } catch (err) {
      console.error('Error fetching stalls:', err);
      setError('Failed to load stalls.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Validation
    if (!formData.item_name || !formData.category || !formData.initial_stock || !formData.unit_price || !formData.sku) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    if (parseInt(formData.initial_stock) <= 0 || parseFloat(formData.unit_price) <= 0) {
      setError('Stock and price must be greater than 0.');
      setLoading(false);
      return;
    }

    try {
      const newItem = {
        item_name: formData.item_name,
        category: formData.category,
        initial_stock: parseInt(formData.initial_stock),
        current_stock: parseInt(formData.initial_stock),
        unit_price: parseFloat(formData.unit_price),
        sku: formData.sku,
        description: formData.description,
        stall_id: formData.selectedStall ? parseInt(formData.selectedStall) : null
      };

      await axios.post('/api/inventory', newItem);
      setSuccessMessage('Item added successfully!');
      
      // Clear form
      setFormData({
        item_name: '',
        category: '',
        initial_stock: '',
        unit_price: '',
        sku: '',
        description: '',
        selectedStall: ''
      });

      // Navigate back to inventory after 2 seconds
      setTimeout(() => {
        navigate('/inventory');
      }, 2000);

    } catch (err: any) {
      console.error('Error adding item:', err);
      setError(err.response?.data?.message || 'Failed to add item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{color: 'var(--primary-800)'}}>Add New Item</h1>
          <p style={{color: 'var(--neutral-600)'}}>Add a new product to your inventory</p>
        </div>
        <button
          onClick={() => navigate('/inventory')}
          className="btn-secondary"
        >
          Back to Inventory
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Name */}
            <div>
              <label htmlFor="item_name" className="block text-sm font-medium text-gray-700 mb-2">
                Item Name *
              </label>
              <input
                type="text"
                id="item_name"
                name="item_name"
                value={formData.item_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter item name"
                required
                disabled={loading}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Jeans, Shirts, Shoes"
                required
                disabled={loading}
              />
            </div>

            {/* Initial Stock */}
            <div>
              <label htmlFor="initial_stock" className="block text-sm font-medium text-gray-700 mb-2">
                Initial Stock *
              </label>
              <input
                type="number"
                id="initial_stock"
                name="initial_stock"
                value={formData.initial_stock}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter initial stock quantity"
                min="1"
                required
                disabled={loading}
              />
            </div>

            {/* Unit Price */}
            <div>
              <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 mb-2">
                Unit Price (KES) *
              </label>
              <input
                type="number"
                id="unit_price"
                name="unit_price"
                value={formData.unit_price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter unit price"
                min="0.01"
                step="0.01"
                required
                disabled={loading}
              />
            </div>

            {/* SKU */}
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                SKU (Stock Keeping Unit) *
              </label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., BJ001, RT001"
                required
                disabled={loading}
              />
            </div>

            {/* Stall Assignment */}
            <div>
              <label htmlFor="selectedStall" className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Stall (Optional)
              </label>
              <select
                id="selectedStall"
                name="selectedStall"
                value={formData.selectedStall}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="">-- Select a stall --</option>
                {stalls.map((stall) => (
                  <option key={stall.stall_id} value={stall.stall_id}>
                    {stall.stall_name} ({stall.manager})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter item description (optional)"
              disabled={loading}
            />
          </div>

          {/* AI Automation Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">🤖 AI Stock Automation</h3>
            <p className="text-blue-700 text-sm mb-3">
              AI will automatically suggest optimal stock distribution based on sales history and demand patterns.
            </p>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  defaultChecked
                />
                <span className="ml-2 text-sm text-blue-700">Enable AI recommendations</span>
              </label>
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-3 rounded-md">
              {successMessage}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding Item...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItem;
