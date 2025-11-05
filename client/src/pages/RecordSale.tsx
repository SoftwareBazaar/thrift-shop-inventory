import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/MockAuthContext';
import { mockApi, InventoryItem, Stall, User } from '../services/mockData';

const RecordSale: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    item_id: '',
    stall_id: '',
    served_by: '',
    quantity_sold: '',
    unit_price: '',
    sale_type: 'cash' as 'cash' | 'mobile' | 'credit' | 'split',
    cash_amount: '',
    mobile_amount: '',
    customer_name: '',
    customer_contact: '',
    due_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsResponse, stallsResponse, usersResponse] = await Promise.all([
        mockApi.getInventory(),
        mockApi.getStalls(),
        mockApi.getUsers()
      ]);
      setItems(itemsResponse.items);
      setStalls(stallsResponse.stalls);
      setUsers(usersResponse.users);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-populate unit price when item is selected
    if (name === 'item_id' && value) {
      const selectedItem = items.find(item => item.item_id === parseInt(value));
      if (selectedItem) {
        setFormData(prev => ({
          ...prev,
          unit_price: selectedItem.unit_price.toString()
        }));
      }
    }

    // Auto-populate stall_id from user if user has a stall
    if (user?.stall_id && !formData.stall_id) {
      setFormData(prev => ({
        ...prev,
        stall_id: user.stall_id!.toString()
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Validation
    if (!formData.item_id || !formData.quantity_sold || !formData.unit_price || !formData.sale_type || !formData.stall_id) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    if (parseInt(formData.quantity_sold) <= 0 || parseFloat(formData.unit_price) <= 0) {
      setError('Quantity and price must be greater than 0.');
      setLoading(false);
      return;
    }

    // For credit sales, customer details are required
    if (formData.sale_type === 'credit' && (!formData.customer_name || !formData.customer_contact)) {
      setError('Customer name and contact are required for credit sales.');
      setLoading(false);
      return;
    }

    // Mobile sales - customer contact is optional
    // (Validation removed to make this field optional)

    try {
      const selectedItem = items.find(item => item.item_id === parseInt(formData.item_id));
      if (selectedItem && selectedItem.current_stock < parseInt(formData.quantity_sold)) {
        setError('Insufficient stock available.');
        setLoading(false);
        return;
      }

      // Determine who recorded the sale
      const recordedBy = user?.role === 'admin' && formData.served_by 
        ? parseInt(formData.served_by)
        : (user?.user_id || 0);

      // Calculate split amounts if needed
      let cash_amount = null;
      let mobile_amount = null;
      const totalAmount = parseInt(formData.quantity_sold) * parseFloat(formData.unit_price);
      
      if (formData.sale_type === 'split') {
        cash_amount = parseFloat(formData.cash_amount) || totalAmount / 2;
        mobile_amount = parseFloat(formData.mobile_amount) || totalAmount / 2;
      }
      
      // Record the sale
      await mockApi.createSale({
        item_id: formData.item_id,
        stall_id: formData.stall_id,
        quantity_sold: parseInt(formData.quantity_sold),
        unit_price: parseFloat(formData.unit_price),
        sale_type: formData.sale_type,
        recorded_by: recordedBy,
        customer_name: formData.customer_name || undefined,
        customer_contact: formData.customer_contact || undefined,
        cash_amount: cash_amount,
        mobile_amount: mobile_amount
      });
      
      setSuccessMessage('Sale recorded successfully!');
      
      // Clear form
      setFormData({
        item_id: '',
        stall_id: user?.stall_id?.toString() || '',
        served_by: '',
        quantity_sold: '',
        unit_price: '',
        sale_type: 'cash',
        customer_name: '',
        customer_contact: '',
        due_date: '',
        notes: '',
        cash_amount: '',
        mobile_amount: ''
      });

      // Navigate back to sales after 2 seconds
      setTimeout(() => {
        navigate('/sales');
      }, 2000);

    } catch (err: any) {
      console.error('Error recording sale:', err);
      setError(err.response?.data?.message || err.message || 'Failed to record sale.');
    } finally {
      setLoading(false);
    }
  };

  // Determine available payment methods based on role
  const getAvailablePaymentMethods = () => {
    if (user?.role === 'admin') {
      return ['cash', 'mobile', 'credit', 'split'];
    }
    return ['cash', 'mobile', 'split'];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{color: 'var(--primary-800)'}}>Record Sale</h1>
          <p style={{color: 'var(--neutral-600)'}}>Record a new sales transaction</p>
        </div>
        <button
          onClick={() => navigate('/sales')}
          className="btn-secondary"
        >
          Back to Sales
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Selection */}
            <div>
              <label htmlFor="item_id" className="block text-sm font-medium text-gray-700 mb-2">
                Item *</label>
              <select
                id="item_id"
                name="item_id"
                value={formData.item_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                <option value="">-- Select an item --</option>
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.item_name} - {formatCurrency(item.unit_price)} ({item.current_stock} in stock)
                  </option>
                ))}
              </select>
            </div>

            {/* Stall Selection */}
            <div>
              <label htmlFor="stall_id" className="block text-sm font-medium text-gray-700 mb-2">
                Stall *</label>
              <select
                id="stall_id"
                name="stall_id"
                value={formData.stall_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                <option value="">-- Select a stall --</option>
                {stalls.map((stall) => (
                  <option key={stall.stall_id} value={stall.stall_id}>
                    {stall.stall_name} - {stall.location}
                  </option>
                ))}
              </select>
              {user?.stall_id && !formData.stall_id && (
                <p className="mt-1 text-xs text-gray-500">Your assigned stall will be pre-selected, but you can change it</p>
              )}
            </div>

            {/* Served By (Admin only) */}
            {user?.role === 'admin' && (
              <div>
                <label htmlFor="served_by" className="block text-sm font-medium text-gray-700 mb-2">
                  Served By *
                </label>
                <select
                  id="served_by"
                  name="served_by"
                  value={formData.served_by}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loading}
                >
                  <option value="">-- Select user --</option>
                  {users.filter(u => u.role === 'user').map((userItem) => (
                    <option key={userItem.user_id} value={userItem.user_id}>
                      {userItem.full_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Select the user who served this sale</p>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label htmlFor="quantity_sold" className="block text-sm font-medium text-gray-700 mb-2">
                Quantity *</label>
              <input
                type="number"
                id="quantity_sold"
                name="quantity_sold"
                value={formData.quantity_sold}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter quantity"
                min="1"
                required
                disabled={loading}
              />
            </div>

            {/* Unit Price */}
            <div>
              <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 mb-2">
                Price Paid (KES) *</label>
              <input
                type="number"
                id="unit_price"
                name="unit_price"
                value={formData.unit_price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter negotiated price"
                min="0.01"
                step="0.01"
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">Items are negotiable - enter the final agreed price</p>
            </div>

            {/* Payment Type */}
            <div>
              <label htmlFor="sale_type" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *</label>
              <select
                id="sale_type"
                name="sale_type"
                value={formData.sale_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                {getAvailablePaymentMethods().map(method => (
                  <option key={method} value={method}>
                    {method === 'split' ? 'Split (Cash + Mobile)' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </option>
                ))}
              </select>
              {user?.role !== 'admin' && (
                <p className="mt-1 text-xs text-gray-500">Credit sales are only available to admins</p>
              )}
            </div>

            {/* Total Amount (calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount</label>
              <input
                type="text"
                value={
                  formData.quantity_sold && formData.unit_price
                    ? `KES ${(parseInt(formData.quantity_sold) * parseFloat(formData.unit_price)).toFixed(2)}`
                    : 'KES 0.00'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                disabled
              />
            </div>
          </div>

          {/* Split Payment Details */}
          {formData.sale_type === 'split' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Split Payment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="cash_amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Cash Amount (KES) *
                  </label>
                  <input
                    type="number"
                    id="cash_amount"
                    name="cash_amount"
                    value={formData.cash_amount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter cash amount"
                    min="0.01"
                    step="0.01"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="mobile_amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Amount (KES) *
                  </label>
                  <input
                    type="number"
                    id="mobile_amount"
                    name="mobile_amount"
                    value={formData.mobile_amount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter mobile amount"
                    min="0.01"
                    step="0.01"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Total: KES {(
                  (parseFloat(formData.cash_amount) || 0) + 
                  (parseFloat(formData.mobile_amount) || 0)
                ).toFixed(2)} | 
                Expected: KES {(parseInt(formData.quantity_sold) * parseFloat(formData.unit_price)).toFixed(2)}
              </p>
            </div>
          )}

          {/* Customer Details (for credit and mobile sales) */}
          {(formData.sale_type === 'credit' || formData.sale_type === 'mobile') && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.sale_type === 'credit' && (
                  <div>
                    <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name *</label>
                    <input
                      type="text"
                      id="customer_name"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter customer name"
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="customer_contact" className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.sale_type === 'credit' ? 'Customer Contact *' : 'Customer Mobile Number (Optional)'}
                  </label>
                  <input
                    type="text"
                    id="customer_contact"
                    name="customer_contact"
                    value={formData.customer_contact}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Phone number"
                    required={formData.sale_type === 'credit'}
                    disabled={loading}
                  />
                  {formData.sale_type === 'mobile' && (
                    <p className="mt-1 text-xs text-gray-500">Optional - Leave blank if not needed</p>
                  )}
                </div>

                {formData.sale_type === 'credit' && (
                  <div>
                    <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date</label>
                    <input
                      type="date"
                      id="due_date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                )}
              </div>

              {formData.sale_type === 'credit' && (
                <div className="mt-4">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional notes (optional)"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          )}

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
              onClick={() => navigate('/sales')}
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
              {loading ? 'Recording Sale...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordSale;

