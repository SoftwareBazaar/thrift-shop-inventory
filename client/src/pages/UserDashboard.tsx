import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';

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
  sale_type: 'cash' | 'credit' | 'mobile' | 'split';
  date_time: string;
  customer_name?: string;
  buying_price?: number;
  cash_amount?: number | null;
  mobile_amount?: number | null;
  recorded_by?: number;
  recorded_by_name?: string;
}

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState('');
  const [saleType, setSaleType] = useState<'cash' | 'mobile' | 'split'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [mobileAmount, setMobileAmount] = useState('');
  const [periodSales, setPeriodSales] = useState(0);
  const [periodUnits, setPeriodUnits] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todayUnits, setTodayUnits] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [saleError, setSaleError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [servedBy, setServedBy] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch items for this user's stall - pass stall_id to get user-specific stock
      const itemsResponse = await dataApi.getInventory(user?.stall_id);
      const userItems = itemsResponse.items || [];
      // Set items with user's distributed stock (not admin's total stock)
      console.log(`[UserDashboard] Fetched ${userItems.length} items for stall_id ${user?.stall_id}:`, userItems);
      setItems(userItems);

      // Fetch sales
      const salesResponse = await dataApi.getSales();
      const allSales = salesResponse.sales || [];

      // Filter sales for this user based on selected period
      const now = new Date();
      const periodStart = new Date();
      if (selectedPeriod === 'week') {
        periodStart.setDate(now.getDate() - 7);
      } else if (selectedPeriod === 'month') {
        periodStart.setDate(now.getDate() - 30);
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const periodSalesData = allSales.filter((sale: any) => {
        const saleDate = new Date(sale.date_time);
        // Filter out credit sales for non-admin users
        if (sale.sale_type === 'credit') return false;
        return saleDate >= periodStart && sale.recorded_by === user?.user_id;
      });

      const dailySalesData = allSales.filter((sale: any) => {
        const saleDate = new Date(sale.date_time);
        if (sale.sale_type === 'credit') return false;
        return saleDate >= startOfToday && sale.recorded_by === user?.user_id;
      });

      setSales(periodSalesData);

      // Calculate totals
      const pSales = periodSalesData.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);
      const pUnits = periodSalesData.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0);

      setPeriodSales(pSales);
      setPeriodUnits(pUnits);

      const tSales = dailySalesData.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);
      const tUnits = dailySalesData.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0);

      setTodaySales(tSales);
      setTodayUnits(tUnits);

      // Fetch users for the "Served By" field
      const usersResponse = await dataApi.getUsers();
      setUsers(usersResponse.users || []);

      // Initial servedBy if not set
      if (!servedBy && user) {
        setServedBy(user.user_id.toString());
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPeriod, servedBy]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 5 seconds to sync data across all users
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

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
    if (!selectedItem || !user) return;

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

      // Calculate split amounts if needed
      // Use mockApi to persist the sale
      await dataApi.createSale({
        item_id: selectedItem.item_id,
        stall_id: user.stall_id || 0,
        quantity_sold: quantity,
        unit_price: price,
        total_amount: totalAmount,
        sale_type: saleType,
        recorded_by: parseInt(servedBy) || user.user_id,
        customer_name: saleType === 'mobile' ? customerName : undefined,
        customer_contact: saleType === 'mobile' ? customerName : undefined,
        cash_amount: cash_amount,
        mobile_amount: mobile_amount
      });

      // Refresh all data
      await fetchDashboardData();

      // Reset form
      setShowSaleForm(false);
      setSelectedItem(null);
      setSaleQuantity(1);
      setSalePrice('');
      setCustomerName('');
      setSaleType('cash');
      setCashAmount('');
      setMobileAmount('');
      setSaleError('');

    } catch (error) {
      console.error('Error recording sale:', error);
      setSaleError(error instanceof Error ? error.message : 'Failed to record sale');
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sm:p-6 rounded-lg">
        <h1 className="text-xl sm:text-2xl font-bold truncate">Welcome, {user?.full_name}</h1>
        <p className="text-sm sm:text-base text-blue-100 mt-1 truncate">Stall Operator Dashboard - {new Date().toLocaleDateString()}</p>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-yellow-500">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Today's Sales</h3>
            <p className="text-xl font-bold text-yellow-600 truncate">{formatCurrency(todaySales)}</p>
            <p className="text-xs text-gray-500 mt-1">{todayUnits} units sold today</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-green-500">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} Sales</h3>
            <p className="text-xl font-bold text-green-600 truncate">{formatCurrency(periodSales)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-blue-500">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Items Sold ({selectedPeriod})</h3>
            <p className="text-xl font-bold text-blue-600 truncate">{periodUnits}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-purple-500">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Available Items</h3>
            <p className="text-xl font-bold text-purple-600 truncate">
              {items.reduce((sum, item) => sum + (item.current_stock || 0), 0)}
            </p>
          </div>
        </div>
      </div>


      {/* Quick Actions */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => setShowSaleForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            Record New Sale
          </button>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
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
                      <p className="text-xs mt-2 text-gray-400">Mode: {navigator.onLine ? 'Online' : 'Offline'}</p>
                      <button
                        onClick={fetchDashboardData}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Check for updates
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">{selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} Sales</h2>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base w-full sm:w-auto"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Served By</th>
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
                    {formatCurrency(sale.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sale.sale_type === 'cash'
                      ? 'bg-green-100 text-green-800'
                      : sale.sale_type === 'mobile'
                        ? 'bg-purple-100 text-purple-800'
                        : sale.sale_type === 'split'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {sale.sale_type === 'split'
                        ? `Cash: ${sale.cash_amount ? formatCurrency(sale.cash_amount) : 'N/A'}, Mobile: ${sale.mobile_amount ? formatCurrency(sale.mobile_amount) : 'N/A'}`
                        : sale.sale_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.recorded_by_name || 'System'}
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
                          setSalePrice(item.unit_price.toString());
                          setSaleError('');
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
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          setSaleQuantity(Number.isNaN(value) ? 0 : Math.max(0, value));
                          setSaleError('');
                        }}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Negotiated Price (KES)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => {
                          setSalePrice(e.target.value);
                          setSaleError('');
                        }}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Default price: {formatCurrency(selectedItem.unit_price)} — adjust if negotiated.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sale Type</label>
                      <select
                        value={saleType}
                        onChange={(e) => {
                          setSaleType(e.target.value as 'cash' | 'mobile' | 'split');
                          setSaleError('');
                        }}
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
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Cash Amount (KES) *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={cashAmount}
                            onChange={(e) => {
                              setCashAmount(e.target.value);
                              setSaleError('');
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                            placeholder="Enter cash amount"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mobile Amount (KES) *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={mobileAmount}
                            onChange={(e) => {
                              setMobileAmount(e.target.value);
                              setSaleError('');
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                            placeholder="Enter mobile amount"
                          />
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-blue-800">
                            Total: {formatCurrency((parseFloat(cashAmount) || 0) + (parseFloat(mobileAmount) || 0))} |
                            Expected: {formatCurrency((saleQuantity || 0) * (parseFloat(salePrice) || 0))}
                          </p>
                        </div>
                      </>
                    )}
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

                {saleError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
                    {saleError}
                  </div>
                )}

                {selectedItem && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Total: {formatCurrency((parseFloat(salePrice) || 0) * (saleQuantity || 0))}</strong>
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
