import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';

interface Sale {
  sale_id: number;
  item_name: string;
  category: string;
  item_id?: number;
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  sale_type: 'cash' | 'credit' | 'mobile' | 'split';
  cash_amount?: number | null;
  mobile_amount?: number | null;
  date_time: string;
  recorded_by: number;
  recorded_by_name: string;
  stall_name: string;
  customer_name?: string;
  customer_contact?: string;
  buying_price?: number;
  payment_status?: string;
  balance_due?: number;
}

interface Stall {
  stall_id: number;
  stall_name: string;
  location: string;
  manager: string;
}

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [selectedStall, setSelectedStall] = useState<number | ''>('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchSales();
    fetchStalls();
    
    // Auto-refresh every 5 seconds to sync data across all users
    const interval = setInterval(() => {
      fetchSales();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchSales = async () => {
    try {
      const response = await dataApi.getSales();
      setSales(response.sales);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStalls = async () => {
    try {
      const response = await dataApi.getStalls();
      setStalls(response.stalls);
    } catch (error) {
      console.error('Error fetching stalls:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  // Filtering logic
  const filteredSales = sales.filter(sale => {
    // Non-admin users cannot see credit sales
    if (user?.role !== 'admin' && sale.sale_type === 'credit') {
      return false;
    }
    
    // Non-admin users can only see their own sales
    if (user?.role !== 'admin' && sale.recorded_by !== user?.user_id) {
      return false;
    }
    
    // Filter by date range
    if (dateRange.startDate) {
      const saleDate = new Date(sale.date_time).toISOString().split('T')[0];
      if (saleDate < dateRange.startDate) return false;
    }
    if (dateRange.endDate) {
      const saleDate = new Date(sale.date_time).toISOString().split('T')[0];
      if (saleDate > dateRange.endDate) return false;
    }
    
    // Filter by stall
    if (selectedStall !== '') {
      const stall = stalls.find(s => s.stall_id === selectedStall);
      if (!stall || sale.stall_name !== stall.stall_name) return false;
    }
    
    // Filter by sale type
    if (saleTypeFilter && sale.sale_type !== saleTypeFilter) return false;
    
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold" style={{color: 'var(--primary-800)'}}>Sales Management</h1>
          <p className="text-sm sm:text-base" style={{color: 'var(--neutral-600)'}}>View and manage sales records</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 sm:flex-nowrap">
          <button
            onClick={() => navigate('/record-sale')}
            className="btn-primary text-sm sm:text-base px-3 sm:px-4 py-2 whitespace-nowrap"
          >
            Record Sale
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/credit-sales')}
              className="btn-accent text-sm sm:text-base px-3 sm:px-4 py-2 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Manage </span>Credit Sales
            </button>
          )}
        </div>
      </div>

      {/* Sales Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-lg font-semibold text-gray-900">{filteredSales.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-xl">💵</span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                {formatCurrency(filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-xl">🛒</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Cash Sales</p>
              <p className="text-lg font-semibold text-gray-900">
                {filteredSales.filter(sale => sale.sale_type === 'cash').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-xl">📱</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Mobile Sales</p>
              <p className="text-lg font-semibold text-gray-900">
                {filteredSales.filter(sale => sale.sale_type === 'mobile').length}
              </p>
            </div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <span className="text-xl">💳</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Credit Sales</p>
                <p className="text-lg font-semibold text-gray-900">
                  {filteredSales.filter(sale => sale.sale_type === 'credit').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Sales Summary */}
      {user?.role === 'admin' && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales by User</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                  {user?.role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  const userSalesMap = sales.reduce((acc, sale) => {
                    const userName = sale.recorded_by_name;
                    if (!acc[userName]) {
                      acc[userName] = {
                        name: userName,
                        totalSales: 0,
                        totalRevenue: 0,
                        cash: 0,
                        mobile: 0,
                        items: {} as Record<string, number>,
                        ...(user?.role === 'admin' && { credit: 0 })
                      };
                    }
                    acc[userName].totalSales += 1;
                    acc[userName].totalRevenue += sale.total_amount;
                    if (sale.sale_type === 'cash') acc[userName].cash += 1;
                    if (sale.sale_type === 'mobile') acc[userName].mobile += 1;
                    if (user?.role === 'admin' && sale.sale_type === 'credit') acc[userName].credit += 1;
                    
                    // Track items sold
                    const itemName = sale.item_name;
                    if (!acc[userName].items[itemName]) {
                      acc[userName].items[itemName] = 0;
                    }
                    acc[userName].items[itemName] += sale.quantity_sold;
                    
                    return acc;
                  }, {} as any);

                  return Object.values(userSalesMap).map((userSales: any) => {
                    // Format items breakdown: "5 Jeans, 3 T-shirts"
                    const itemsBreakdown = Object.entries(userSales.items)
                      .map(([itemName, quantity]) => `${quantity} ${itemName}`)
                      .join(', ');

                    return (
                      <tr key={userSales.name} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {userSales.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs">
                            {itemsBreakdown || 'No items'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userSales.totalSales}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(userSales.totalRevenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userSales.cash}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userSales.mobile}
                        </td>
                        {user?.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {userSales.credit}
                          </td>
                        )}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Stall</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Sale Type</label>
            <select
              value={saleTypeFilter}
              onChange={(e) => setSaleTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="cash">Cash Sales</option>
              <option value="mobile">Mobile Sales</option>
              {user?.role === 'admin' && (
                <option value="credit">Credit Sales</option>
              )}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedStall('');
                setSaleTypeFilter('');
                setDateRange({ startDate: '', endDate: '' });
              }}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Selling Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recorded By
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(sale.date_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{sale.item_name}</div>
                      <div className="text-sm text-gray-500">{sale.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.quantity_sold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(sale.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      sale.sale_type === 'cash' 
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
                    {sale.customer_name ? (
                      <div>
                        <div className="font-medium">{sale.customer_name}</div>
                        <div className="text-gray-500">{sale.customer_contact}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.recorded_by_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSales.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-400 text-6xl mb-4">💰</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {sales.length === 0 ? 'No sales recorded yet' : 'No sales match your filters'}
          </h3>
          <p className="text-gray-600 mb-4">
            {sales.length === 0 
              ? 'Start by recording your first sale to track revenue'
              : 'Try adjusting your filters or date range'}
          </p>
          {sales.length === 0 && (
            <button
              onClick={() => navigate('/record-sale')}
              className="btn-primary mt-4"
            >
              ➕ Record Your First Sale
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sales;
