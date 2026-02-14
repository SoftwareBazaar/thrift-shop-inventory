import React, { useState, useEffect, useCallback } from 'react';
import { dataApi } from '../services/dataService';

interface Stall {
  stall_id: number;
  stall_name: string;
  user_id: number;
  location: string;
  manager: string;
  status: string;
}

interface Sale {
  sale_id: number;
  item_name: string;
  item_id?: number;
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  sale_type: string;
  date_time: string;
  recorded_by: number;
  recorded_by_name: string;
  stall_name: string;
  buying_price?: number;
  cash_amount?: number | null;
  mobile_amount?: number | null;
}

interface Analytics {
  totalRevenue: number;
  cumulativeRevenue: number;
  totalSales: number;
  totalUnits: number;
  averageSale: number;
  topSellingItems: Array<{ item_name: string; total_sold: number; revenue: number }>;
  userPerformance: Array<{ user_name: string; sales: number; revenue: number }>;
  dailySales: Array<{ date: string; sales: number; revenue: number }>;
  commissionData: Array<{ user_name: string; sales: number; commission: number }>;
}

const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [inventoryResponse, setInventoryResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [todaySales, setTodaySales] = useState(0);

  const fetchAdminData = useCallback(async () => {
    try {
      // Fetch stalls
      const stallsResponse = await dataApi.getStalls();
      setStalls(stallsResponse.stalls || []);

      // Fetch inventory for stock value calculation
      const inventoryResp = await dataApi.getInventory();
      const sortedItems = [...(inventoryResp.items || [])].sort((a, b) =>
        a.item_name.localeCompare(b.item_name, undefined, { sensitivity: 'base' })
      );
      setInventoryResponse({ ...inventoryResp, items: sortedItems });

      // Fetch recent sales
      const recentSalesResponse = await dataApi.getSales();
      const allSales = recentSalesResponse.sales || [];

      // Sort sales by date (newest first) for timely display
      const sortedSales = [...allSales].sort((a, b) => {
        const dateA = new Date(a.date_time).getTime();
        const dateB = new Date(b.date_time).getTime();
        return dateB - dateA;
      });

      setAllSales(sortedSales);

      // Filter sales based on selected period
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let filteredSales = allSales;
      let runningTotalEnd = new Date();

      if (selectedPeriod === 'today') {
        filteredSales = allSales.filter(sale => new Date(sale.date_time) >= startOfToday);
      } else if (selectedPeriod === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        filteredSales = allSales.filter(sale => new Date(sale.date_time) >= startOfWeek);
      } else if (selectedPeriod === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredSales = allSales.filter(sale => new Date(sale.date_time) >= startOfMonth);
      } else if (selectedPeriod === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filteredSales = allSales.filter(sale => new Date(sale.date_time) >= startOfYear);
      } else if (selectedPeriod === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = allSales.filter(sale => {
          const saleDate = new Date(sale.date_time);
          return saleDate >= start && saleDate <= end;
        });
        runningTotalEnd = end;
      }

      const totalRevenue = filteredSales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
      const cumulativeRevenue = allSales.reduce((sum: number, sale: any) => {
        if (new Date(sale.date_time) <= runningTotalEnd) {
          return sum + (sale.total_amount || 0);
        }
        return sum;
      }, 0);

      const itemSalesMap = new Map<string, { total_sold: number; revenue: number }>();
      filteredSales.forEach((sale: any) => {
        const existing = itemSalesMap.get(sale.item_name) || { total_sold: 0, revenue: 0 };
        itemSalesMap.set(sale.item_name, {
          total_sold: existing.total_sold + sale.quantity_sold,
          revenue: existing.revenue + sale.total_amount
        });
      });

      const topSellingItems = Array.from(itemSalesMap.entries())
        .map(([item_name, data]) => ({ item_name, ...data }))
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 5);

      const userSalesMap = new Map<string, { sales: number; revenue: number }>();
      filteredSales.forEach((sale: any) => {
        const userName = sale.recorded_by_name || 'Unknown';
        const existing = userSalesMap.get(userName) || { sales: 0, revenue: 0 };
        userSalesMap.set(userName, {
          sales: existing.sales + 1,
          revenue: existing.revenue + sale.total_amount
        });
      });

      const userPerformance = Array.from(userSalesMap.entries())
        .map(([user_name, data]) => ({ user_name, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      const analyticsData: Analytics = {
        totalRevenue: totalRevenue,
        cumulativeRevenue: cumulativeRevenue,
        totalSales: filteredSales.length,
        totalUnits: filteredSales.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0),
        averageSale: filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0,
        topSellingItems: topSellingItems,
        userPerformance: userPerformance,
        dailySales: [],
        commissionData: userPerformance.map(user => ({
          user_name: user.user_name,
          sales: user.sales,
          commission: user.revenue * 0.05
        }))
      };

      setAnalytics(analyticsData);
      const todaySalesData = allSales.filter(sale => new Date(sale.date_time) >= startOfToday);
      setTodaySales(todaySalesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0));

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, startDate, endDate]);

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(() => fetchAdminData(), 5000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getStallSalesSummary = (stallName: string) => {
    const stallSales = allSales.filter(sale => sale.stall_name === stallName);
    const revenue = stallSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const count = stallSales.length;

    const contributorMap = new Map<string, number>();
    stallSales.forEach(sale => {
      if (sale.recorded_by_name) {
        const currentAmount = contributorMap.get(sale.recorded_by_name) || 0;
        contributorMap.set(sale.recorded_by_name, currentAmount + sale.total_amount);
      }
    });

    const contributors = Array.from(contributorMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { revenue, count, contributors };
  };

  const items = inventoryResponse?.items || [];
  const totalStockValue = items.reduce((sum: number, item: any) => {
    // Current Stock in system = Central Stock + Distributed Stock (unsold)
    const centralStock = Number(item.current_stock) || 0;
    const itemSales = allSales.filter(s => s.item_id === item.item_id || s.item_name === item.item_name);
    const totalSold = itemSales.reduce((sum, s: any) => sum + (s.quantity_sold || 0), 0);
    const distributedLive = Math.max(0, (Number(item.total_allocated) || 0) - totalSold);

    const unsoldStock = centralStock + distributedLive;
    return sum + (unsoldStock * (Number(item.buying_price) || 0));
  }, 0);

  const revenue = analytics?.cumulativeRevenue || 0;
  const grossProfit = revenue - totalStockValue;
  const profitTone = grossProfit > 0 ? 'text-green-600' : grossProfit < 0 ? 'text-red-600' : 'text-orange-500';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading admin dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-primary text-white p-4 sm:p-6 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-blue-100 mt-1 truncate">System Overview & Analytics - {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {['today', 'week', 'month', 'year', 'custom'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === period
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1).replace('custom', 'Custom Range').replace('week', 'This Week').replace('month', 'This Month').replace('year', 'This Year')}
                </button>
              ))}
            </div>

            {selectedPeriod === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg border-2 border-white shadow-md">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 text-sm font-medium border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 text-sm font-medium border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-yellow-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2">
            <div className="flex flex-col items-center bg-white border border-gray-200 rounded-lg shadow-sm" style={{ width: '40px' }}>
              <div className="bg-red-500 text-white text-[7px] font-bold py-0.5 w-full text-center rounded-t">
                {new Date().toLocaleString('en', { month: 'short' }).toUpperCase()}
              </div>
              <div className="text-xl font-bold text-gray-800 py-1">{new Date().getDate()}</div>
            </div>
          </div>
          <div className="flex flex-col relative z-10 pl-12">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Sales</h3>
            <p className="text-lg font-bold text-yellow-600 break-words">{formatCurrency(todaySales)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-blue-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100">💰</div>
          <div className="flex flex-col relative z-10 pl-12">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</h3>
            <p className="text-lg font-bold text-blue-600 break-words">{formatCurrency(analytics?.cumulativeRevenue || 0)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-purple-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100">📦</div>
          <div className="flex flex-col relative z-10 pl-12">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</h3>
            <p className="text-lg font-bold text-purple-600 break-words">{analytics?.totalUnits || 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-indigo-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100">🏦</div>
          <div className="flex flex-col relative z-10 pl-12">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</h3>
            <p className="text-base font-bold text-indigo-600 break-words">{formatCurrency(totalStockValue)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-orange-500 relative overflow-hidden">
          <div className="absolute left-2 bottom-2 text-4xl opacity-100">📈</div>
          <div className="flex flex-col relative z-10 pl-12">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Profit</h3>
            <p className={`text-lg font-bold ${profitTone} break-words`}>{formatCurrency(grossProfit)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">User Performance</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {analytics?.userPerformance.map((user, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <h3 className="font-medium text-gray-900">{user.user_name}</h3>
                    <p className="text-xs text-gray-500">{user.sales} sales recorded</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(user.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">Top Selling Items</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {analytics?.topSellingItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                    <p className="text-xs text-gray-500">{item.total_sold} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{formatCurrency(item.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Stalls Overview</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stalls.map((stall) => {
              const summary = getStallSalesSummary(stall.stall_name);
              return (
                <div key={stall.stall_id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900">{stall.stall_name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${stall.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {stall.status}
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-gray-600 flex items-center gap-1">👤 <span className="font-medium">{stall.manager}</span></p>
                    <p className="text-xs text-gray-600 flex items-center gap-1">📍 <span>{stall.location}</span></p>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Recent Sales</span>
                      <span>{summary.count} items</span>
                    </div>
                    <p className="text-lg font-bold text-blue-600 mb-2">{formatCurrency(summary.revenue)}</p>
                    {summary.contributors.length > 0 && (
                      <div className="space-y-1">
                        {summary.contributors.slice(0, 3).map((contributor, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] bg-white border border-gray-100 px-2 py-1 rounded">
                            <span className="text-gray-700">{contributor.name}</span>
                            <span className="font-bold text-gray-900">{formatCurrency(contributor.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
