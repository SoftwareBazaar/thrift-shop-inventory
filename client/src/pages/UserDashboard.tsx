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
  const [periodUnits, setPeriodUnits] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todayUnits, setTodayUnits] = useState(0);
  const [cumulativeSales, setCumulativeSales] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

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
      const pUnits = periodSalesData.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0);

      setPeriodUnits(pUnits);

      const tSales = dailySalesData.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);
      const tUnits = dailySalesData.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0);

      setTodaySales(tSales);
      setTodayUnits(tUnits);

      // Calculate cumulative sales for this user
      const userFullSales = allSales.filter((sale: any) => sale.recorded_by === user?.user_id && sale.sale_type !== 'credit');
      const cSales = userFullSales.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);
      setCumulativeSales(cSales);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPeriod]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 5 seconds to sync data across all users
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

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
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-yellow-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 opacity-100 pointer-events-none">
            <div className="flex flex-col items-center bg-white border-2 border-gray-300 rounded-lg shadow-sm" style={{ width: '48px' }}>
              <div className="bg-red-500 text-white text-[8px] font-bold py-0.5 w-full text-center rounded-t">
                {new Date().toLocaleString('en', { month: 'short' }).toUpperCase()}
              </div>
              <div className="text-2xl font-bold text-gray-800 py-1">
                {new Date().getDate()}
              </div>
            </div>
          </div>
          <div className="flex flex-col relative z-10 pl-14">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Sales</h3>
            <p className="text-lg font-bold text-yellow-600">{formatCurrency(todaySales)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{todayUnits} units sold today</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-green-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100 pointer-events-none">
            💰
          </div>
          <div className="flex flex-col relative z-10 pl-14">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</h3>
            <p className="text-lg font-bold text-green-600">{formatCurrency(cumulativeSales)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Cumulative earnings</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-blue-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100 pointer-events-none">
            📦
          </div>
          <div className="flex flex-col relative z-10 pl-14">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Items Sold ({selectedPeriod})</h3>
            <p className="text-lg font-bold text-blue-600">{periodUnits}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-purple-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100 pointer-events-none">
            🏗️
          </div>
          <div className="flex flex-col relative z-10 pl-14">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Available Items</h3>
            <p className="text-lg font-bold text-purple-600">
              {items.reduce((sum, item) => sum + (item.current_stock || 0), 0)}
            </p>
          </div>
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
    </div>
  );
};

export default UserDashboard;
