import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';

interface SaleItem {
  item_id: number;
  item_name: string;
  current_stock: number;
  unit_price: number;
  category: string;
}

const UserSaleItems: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState('');
  const [saleType, setSaleType] = useState<'cash' | 'mobile' | 'split'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [mobileAmount, setMobileAmount] = useState('');
  const [saleError, setSaleError] = useState('');
  const [servedBy, setServedBy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const fetchItemsData = useCallback(async () => {
    try {
      const itemsResponse = await dataApi.getInventory(user?.stall_id);
      setItems(itemsResponse.items || []);

      const usersResponse = await dataApi.getUsers();
      setUsers(usersResponse.users || []);

      if (!servedBy && user) {
        setServedBy(user.user_id.toString());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, servedBy]);

  useEffect(() => {
    fetchItemsData();
    const interval = setInterval(() => {
      fetchItemsData();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchItemsData]);

  const handleItemSelect = (item: SaleItem) => {
    setSelectedItem(item);
    setSaleQuantity(1);
    setSalePrice(item.unit_price.toString());
    setSaleError('');
    if (user) setServedBy(user.user_id.toString());
    setShowSaleForm(true);
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const quantity = Number.isFinite(saleQuantity) ? saleQuantity : 0;
      const price = parseFloat(salePrice);

      if (!quantity || quantity <= 0) {
        setSaleError('Quantity must be at least 1.');
        return;
      }
      if (quantity > (selectedItem.current_stock || 0)) {
        setSaleError('Insufficient stock available for this item.');
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        setSaleError('Enter a valid selling price greater than zero.');
        return;
      }

      const totalAmount = quantity * price;
      let cash_amount = null;
      let mobile_amount = null;

      if (saleType === 'split') {
        const cashValue = parseFloat(cashAmount);
        const mobileValue = parseFloat(mobileAmount);

        if (!cashAmount || !mobileAmount || !Number.isFinite(cashValue) || !Number.isFinite(mobileValue)) {
          setSaleError('Enter both cash and mobile amounts for split payments.');
          return;
        }
        if (cashValue <= 0 || mobileValue <= 0) {
          setSaleError('Split payment amounts must be greater than zero.');
          return;
        }
        if (Math.abs((cashValue + mobileValue) - totalAmount) > 0.5) {
          setSaleError('Cash and mobile totals must equal the negotiated amount.');
          return;
        }
        cash_amount = cashValue;
        mobile_amount = mobileValue;
      }

      setSaleError('');

      await dataApi.createSale({
        item_id: selectedItem.item_id,
        stall_id: user.stall_id || null,
        quantity_sold: quantity,
        unit_price: price,
        sale_type: saleType,
        customer_name: customerName,
        cash_amount,
        mobile_amount,
        total_amount: totalAmount,
        recorded_by: parseInt(servedBy || user.user_id.toString())
      });

      setShowSaleForm(false);
      fetchItemsData();
    } catch (error: any) {
      console.error('Error recording sale:', error);
      setSaleError(error.message || 'Error recording sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Available Items for Sale</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.current_stock} units
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleItemSelect(item)}
                        disabled={item.current_stock === 0}
                        className="text-green-600 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        {item.current_stock === 0 ? 'Out of Stock' : 'Sell'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">📥</span>
                      <p className="text-lg font-medium">No items distributed yet</p>
                      <p className="text-sm">Contact admin to distribute stock to your stall (ID: {user?.stall_id || 'N/A'})</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSaleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex justify-between items-center mb-4 sm:mb-6">
              Record Sale
              <button onClick={() => setShowSaleForm(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </h2>

            {saleError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <p className="text-sm text-red-700 whitespace-pre-wrap">{saleError}</p>
              </div>
            )}

            <form onSubmit={handleSaleSubmit} className="space-y-4 sm:space-y-6">
              {!selectedItem ? null : (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900">{selectedItem.item_name}</h4>
                      <p className="text-sm text-gray-500 font-medium">Stock: {selectedItem.current_stock} available</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedItem?.current_stock}
                        value={saleQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSaleQuantity(val);
                        }}
                        className="block w-full py-2 px-3 border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Selling Price Each *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sale Type</label>
                      <select
                        value={saleType}
                        onChange={(e) => setSaleType(e.target.value as 'cash' | 'mobile' | 'split')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="mobile">Mobile</option>
                        <option value="split">Split (Cash + Mobile)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Served By *</label>
                      <select
                        value={servedBy}
                        onChange={(e) => setServedBy(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">-- Select staff --</option>
                        {users.map((u) => (
                          <option key={u.user_id} value={u.user_id.toString()}>
                            {u.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {saleType === 'split' && (
                      <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Cash (KES) *</label>
                          <input
                            type="number"
                            value={cashAmount}
                            onChange={(e) => setCashAmount(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mobile (KES) *</label>
                          <input
                            type="number"
                            value={mobileAmount}
                            onChange={(e) => setMobileAmount(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedItem && saleType === 'mobile' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Mobile Number (Optional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSaleForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !!saleError}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSaleItems;
