import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { mockApi } from '../services/mockData';

interface SaleItem {
  item_id: number;
  item_name: string;
  current_stock: number;
  unit_price: number;
  buying_price?: number;
  category: string;
}

interface Sale {
  sale_id: number;
  item_name: string;
  item_id?: number;
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  sale_type: 'cash' | 'credit' | 'mobile';
  date_time: string;
  customer_name?: string;
  buying_price?: number;
}

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleType, setSaleType] = useState<'cash' | 'mobile'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [todaySales, setTodaySales] = useState(0);
  const [todayUnits, setTodayUnits] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch items for this user's stall
      const itemsResponse = await mockApi.getInventory();
      const allItems = itemsResponse.items || [];
      
      // Filter items for user's stall (in real system, this would be filtered by stall_id)
      setItems(allItems);

      // Fetch sales
      const salesResponse = await mockApi.getSales();
      const allSales = salesResponse.sales || [];
      
      // Filter sales for this user based on selected period
      const now = new Date();
      const periodStart = new Date();
      if (selectedPeriod === 'week') {
        periodStart.setDate(now.getDate() - 7);
      } else if (selectedPeriod === 'month') {
        periodStart.setDate(now.getDate() - 30);
      }
      
      const periodSalesData = allSales.filter((sale: any) => {
        const saleDate = new Date(sale.date_time);
        return saleDate >= periodStart && sale.recorded_by === user?.user_id;
      });
      
      setSales(periodSalesData);
      
      // Calculate totals
      const totalSales = periodSalesData.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);
      const totalUnits = periodSalesData.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0);
      
      setTodaySales(totalSales);
      setTodayUnits(totalUnits);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPeriod]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleItemSelect = (item: SaleItem) => {
    setSelectedItem(item);
    setSaleQuantity(1);
    setShowSaleForm(true);
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !user) return;

    try {
      // Use mockApi to persist the sale
      await mockApi.createSale({
        item_id: selectedItem.item_id,
        stall_id: user.stall_id || 0,
        quantity_sold: saleQuantity,
        unit_price: selectedItem.unit_price,
        sale_type: saleType,
        recorded_by: user.user_id,
        customer_name: saleType === 'mobile' ? customerName : undefined,
        customer_contact: saleType === 'mobile' ? customerName : undefined
      });

      // Refresh all data
      await fetchDashboardData();

      // Reset form
      setShowSaleForm(false);
      setSelectedItem(null);
      setSaleQuantity(1);
      setCustomerName('');
      setSaleType('cash');

    } catch (error) {
      console.error('Error recording sale:', error);
      alert('Failed to record sale');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading your dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold">Welcome, {user?.full_name}</h1>
        <p className="text-blue-100">Stall Operator Dashboard - {new Date().toLocaleDateString()}</p>
      </div>

      {/* Today's Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">💰</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">{selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} Sales</h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(todaySales)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">📦</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Items Sold</h3>
              <p className="text-2xl font-bold text-blue-600">{todayUnits}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">🏪</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Available Items</h3>
              <p className="text-2xl font-bold text-purple-600">{items.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowSaleForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            💰 Record New Sale
          </button>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Available Items */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buying Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
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
                    {formatCurrency(item.buying_price || 0)}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">{selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} Sales</h2>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buying Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale.item_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.quantity_sold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.buying_price || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      sale.sale_type === 'cash' 
                        ? 'bg-green-100 text-green-800' 
                        : sale.sale_type === 'mobile'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {sale.sale_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.date_time).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Form Modal */}
      {showSaleForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Record Sale</h3>
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                {!selectedItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Item *</label>
                    <select
                      onChange={(e) => {
                        const item = items.find(i => i.item_id === parseInt(e.target.value));
                        setSelectedItem(item || null);
                        if (item) {
                          setSaleQuantity(1);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">-- Select an item --</option>
                      {items.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_name} ({item.current_stock} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedItem && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">{selectedItem.item_name}</h4>
                    <p className="text-sm text-gray-600">Available: {selectedItem.current_stock} units</p>
                    <p className="text-sm text-gray-600">Price: {formatCurrency(selectedItem.unit_price)} each</p>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Change Item
                    </button>
                  </div>
                )}

                {selectedItem && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedItem.current_stock}
                        value={saleQuantity}
                        onChange={(e) => setSaleQuantity(parseInt(e.target.value))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sale Type</label>
                      <select
                        value={saleType}
                        onChange={(e) => setSaleType(e.target.value as 'cash' | 'mobile')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="mobile">Mobile</option>
                      </select>
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
                      placeholder="Enter customer phone number"
                    />
                    <p className="mt-1 text-xs text-gray-500">Optional - Leave blank if not needed</p>
                  </div>
                )}

                {selectedItem && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Total: {formatCurrency((selectedItem.unit_price * saleQuantity))}</strong>
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={!selectedItem}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Record Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaleForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
