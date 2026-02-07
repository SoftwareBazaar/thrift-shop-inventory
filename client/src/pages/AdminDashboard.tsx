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
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [inventoryResponse, setInventoryResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editSaleData, setEditSaleData] = useState({
    quantity_sold: '',
    unit_price: '',
    total_amount: '',
    sale_type: 'cash' as 'cash' | 'credit' | 'mobile' | 'split',
    cash_amount: '',
    mobile_amount: '',
    recorded_by: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [todaySales, setTodaySales] = useState(0);

  const fetchAdminData = useCallback(async () => {
    try {
      // Fetch users for "Recorded By" dropdown
      const usersResponse = await dataApi.getUsers();
      setUsers(usersResponse.users || []);

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
        return dateB - dateA; // Descending order (newest first)
      });

      setAllSales(sortedSales);
      setRecentSales(sortedSales.slice(0, 10));

      // Filter sales based on selected period
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let filteredSales = allSales;
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
      }

      // Calculate total revenue from filtered sales
      const totalRevenue = filteredSales.reduce((sum: number, sale: any) => {
        return sum + (sale.total_amount || 0);
      }, 0);

      // Stock Value = Total stock value in monetary terms
      // (calculated in the render section)

      // Calculate top selling items from filtered sales
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

      // Calculate user performance from filtered sales
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

      // Calculate commission data
      const commissionData = userPerformance.map(user => ({
        user_name: user.user_name,
        sales: user.sales,
        commission: user.revenue * 0.05
      }));

      // Use analytics data
      const analyticsData: Analytics = {
        totalRevenue: totalRevenue,
        totalSales: filteredSales.length,
        totalUnits: filteredSales.reduce((sum: number, sale: any) => sum + sale.quantity_sold, 0),
        averageSale: filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0,
        topSellingItems: topSellingItems,
        userPerformance: userPerformance,
        dailySales: [],
        commissionData: commissionData
      };

      setAnalytics(analyticsData);

      // Calculate today's sales specifically
      const todaySalesData = allSales.filter(sale => new Date(sale.date_time) >= startOfToday);
      const totalTodayRevenue = todaySalesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      setTodaySales(totalTodayRevenue);

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, startDate, endDate]);

  useEffect(() => {
    fetchAdminData();

    // Auto-refresh every 5 seconds to sync data across all users
    const interval = setInterval(() => {
      fetchAdminData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAdminData, selectedPeriod, startDate, endDate]);

  const handleDeleteSale = async (saleId: number) => {
    if (!window.confirm('Are you sure you want to delete this sale? This will restore the item stock.')) return;
    try {
      await dataApi.deleteSale(saleId);
      await fetchAdminData();
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Failed to delete sale');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getStallSalesSummary = (stallName: string): { revenue: number; count: number; contributors: Array<{ name: string; amount: number }> } => {
    const stallSales = allSales.filter(sale => sale.stall_name === stallName);
    const revenue = stallSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const count = stallSales.length;

    // Get all contributors with their individual contribution amounts
    const contributorMap = new Map<string, number>();
    stallSales.forEach(sale => {
      if (sale.recorded_by_name) {
        const currentAmount = contributorMap.get(sale.recorded_by_name) || 0;
        contributorMap.set(sale.recorded_by_name, currentAmount + sale.total_amount);
      }
    });

    // Convert to array and sort by amount (descending)
    const contributors = Array.from(contributorMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { revenue, count, contributors };
  };

  const downloadReport = async (type: 'pdf' | 'excel', endpoint: 'performance' | 'inventory' | 'sales' = 'performance') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Using /api as the default base for reports - this works on Vercel and locally if proxied
      const apiUrl = process.env.REACT_APP_API_URL || '/api';

      const response = await fetch(`${apiUrl}/reports/${endpoint}?format=${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sales: allSales,
          items: items,
          // We can also pass analytics if the backend needs pre-calculated values
          analytics: analytics
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate ${endpoint} report`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${endpoint}-report-${new Date().toISOString().split('T')[0]}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading ${endpoint} report:`, error);
      alert(error instanceof Error ? error.message : `Failed to download ${endpoint} report. Please ensure the server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const items = inventoryResponse?.items || [];
  const itemCostMap = new Map<number, number>();
  items.forEach((item: any) => {
    if (item?.item_id != null) {
      itemCostMap.set(item.item_id, Number(item.buying_price) || 0);
    }
  });

  // Calculate total units sold per item for accurate system-wide stock tracking
  const itemSoldMap = new Map<number, number>();
  allSales.forEach(sale => {
    if (sale.item_id) {
      const current = itemSoldMap.get(sale.item_id) || 0;
      itemSoldMap.set(sale.item_id, current + (sale.quantity_sold || 0));
    }
  });

  const totalStockValue = items.reduce((sum: number, item: any) => {
    const sold = itemSoldMap.get(item.item_id) || 0;
    const totalReceived = (Number(item.initial_stock) || 0) + (Number(item.total_added) || 0);
    const available = Math.max(0, totalReceived - sold);
    return sum + (available * (Number(item.unit_price) || 0));
  }, 0);


  const revenue = analytics?.totalRevenue || 0;
  const totalInvestment = items.reduce((sum: number, item: any) => {
    // Investment is based on all stock ever added (initial + additions)
    const totalStockQty = Number(item.initial_stock || 0) + Number(item.total_added || 0);
    const costPerUnit = Number(item.buying_price || 0);
    return sum + (totalStockQty * costPerUnit);
  }, 0);

  const grossProfit = revenue - totalInvestment;
  const profitTone =
    grossProfit > 0 ? 'text-green-600' : grossProfit < 0 ? 'text-red-600' : 'text-orange-500';

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
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === 'today'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === 'week'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                This Week
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                This Month
              </button>
              <button
                onClick={() => setSelectedPeriod('year')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === 'year'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                This Year
              </button>
              <button
                onClick={() => setSelectedPeriod('custom')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedPeriod === 'custom'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Custom Range
              </button>
            </div>

            {selectedPeriod === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-blue-700 uppercase">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-blue-700 uppercase">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
              <button
                onClick={() => downloadReport('pdf', 'performance')}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded font-medium text-xs sm:text-sm flex items-center gap-1"
                title="Performance Report"
              >
                Performance
              </button>
              <button
                onClick={() => downloadReport('pdf', 'inventory')}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded font-medium text-xs sm:text-sm flex items-center gap-1"
                title="Stock Inventory"
              >
                Inventory
              </button>
              <button
                onClick={() => downloadReport('pdf', 'sales')}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-medium text-xs sm:text-sm flex items-center gap-1"
                title="Sales Transactions"
              >
                Sales
              </button>
            </div>
            <button
              onClick={() => downloadReport('excel', 'performance')}
              className="bg-green-500 hover:bg-green-600 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap hidden sm:block"
              title="Performance Excel"
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-yellow-500">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Sales</h3>
              <p className="text-lg font-bold text-yellow-600 leading-tight">
                {formatCurrency(todaySales)}
              </p>
            </div>
            <span className="text-2xl" role="img" aria-label="today sales">📅</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</h3>
              <p className="text-lg font-bold text-blue-600 leading-tight">
                {formatCurrency(analytics?.totalRevenue || 0)}
              </p>
            </div>
            <span className="text-2xl" role="img" aria-label="total revenue">💰</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</h3>
              <p className="text-lg font-bold text-purple-600">{analytics?.totalUnits || 0}</p>
              <p className="text-[10px] text-gray-400 mt-1">Physical items moved</p>
            </div>
            <span className="text-2xl" role="img" aria-label="units sold">📦</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-indigo-500">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</h3>
              <p className="text-base font-bold text-indigo-600">
                {formatCurrency(totalStockValue)}
              </p>
            </div>
            <span className="text-2xl" role="img" aria-label="stock value">🏦</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-lg border-l-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Profit</h3>
              <p className={`text-lg font-bold ${profitTone}`}>
                {formatCurrency(grossProfit)}
              </p>
            </div>
            <span className="text-2xl" role="img" aria-label="gross profit">📈</span>
          </div>
        </div>
      </div>

      {/* User Performance & Commission */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">User Performance</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analytics?.userPerformance.map((user, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{user.user_name}</h3>
                    <p className="text-sm text-gray-600">{user.sales} sales</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(user.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Top Selling Items</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analytics?.topSellingItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                    <p className="text-sm text-gray-600">{item.total_sold} units sold</p>
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

      {/* Stalls Management */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Stalls Overview</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stalls.map((stall) => {
              const summary = getStallSalesSummary(stall.stall_name);
              return (
                <div key={stall.stall_id} className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900">{stall.stall_name}</h3>
                  <p className="text-sm text-gray-600">Manager: {stall.manager}</p>
                  <p className="text-sm text-gray-600">Location: {stall.location}</p>
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs text-gray-600">Sales: {summary.count}</p>
                    <p className="text-sm font-semibold text-blue-600">{formatCurrency(summary.revenue)}</p>
                    {summary.contributors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Contributors:</p>
                        <div className="flex flex-col gap-1 mt-1">
                          {summary.contributors.map((contributor, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                              <span className="font-medium text-blue-900">{contributor.name}</span>
                              <span className="text-blue-700 font-semibold">{formatCurrency(contributor.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stall.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {stall.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Sales Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sold By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stall</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentSales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale.item_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.quantity_sold}
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
                    {sale.recorded_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.stall_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.date_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedSale(sale);
                        setEditSaleData({
                          quantity_sold: sale.quantity_sold.toString(),
                          unit_price: sale.unit_price.toString(),
                          total_amount: sale.total_amount.toString(),
                          sale_type: sale.sale_type as 'cash' | 'credit' | 'mobile' | 'split',
                          cash_amount: sale.cash_amount?.toString() || '',
                          mobile_amount: sale.mobile_amount?.toString() || '',
                          recorded_by: sale.recorded_by.toString()
                        });
                        setShowEditSaleModal(true);
                      }}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSale(sale.sale_id)}
                      className="ml-3 text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Sale Modal */}
      {showEditSaleModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Sale</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const updateData: any = {
                  quantity_sold: parseInt(editSaleData.quantity_sold),
                  unit_price: parseFloat(editSaleData.unit_price),
                  total_amount: parseFloat(editSaleData.total_amount),
                  sale_type: editSaleData.sale_type,
                  recorded_by: parseInt(editSaleData.recorded_by)
                };

                if (editSaleData.sale_type === 'split') {
                  updateData.cash_amount = parseFloat(editSaleData.cash_amount);
                  updateData.mobile_amount = parseFloat(editSaleData.mobile_amount);
                }

                await dataApi.updateSale(selectedSale.sale_id, updateData);
                setShowEditSaleModal(false);
                fetchAdminData();
                alert('Sale updated successfully!');
              } catch (error: any) {
                alert(error.message || 'Failed to update sale');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <input
                  type="text"
                  value={selectedSale.item_name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Sold *</label>
                <input
                  type="number"
                  value={editSaleData.quantity_sold}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value) || 0;
                    const price = parseFloat(editSaleData.unit_price) || 0;
                    setEditSaleData(prev => ({
                      ...prev,
                      quantity_sold: e.target.value,
                      total_amount: (qty * price).toString()
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (KES) *</label>
                <input
                  type="number"
                  value={editSaleData.unit_price}
                  onChange={(e) => {
                    const qty = parseInt(editSaleData.quantity_sold) || 0;
                    const price = parseFloat(e.target.value) || 0;
                    setEditSaleData(prev => ({
                      ...prev,
                      unit_price: e.target.value,
                      total_amount: (qty * price).toString()
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (KES) *</label>
                <input
                  type="number"
                  value={editSaleData.total_amount}
                  onChange={(e) => setEditSaleData(prev => ({ ...prev, total_amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type *</label>
                <select
                  value={editSaleData.sale_type}
                  onChange={(e) => setEditSaleData(prev => ({ ...prev, sale_type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="mobile">Mobile</option>
                  <option value="credit">Credit</option>
                  <option value="split">Split (Cash + Mobile)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recorded By *</label>
                <select
                  value={editSaleData.recorded_by}
                  onChange={(e) => setEditSaleData(prev => ({ ...prev, recorded_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a user...</option>
                  {users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {editSaleData.sale_type === 'split' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount (KES) *</label>
                    <input
                      type="number"
                      value={editSaleData.cash_amount}
                      onChange={(e) => setEditSaleData(prev => ({ ...prev, cash_amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Amount (KES) *</label>
                    <input
                      type="number"
                      value={editSaleData.mobile_amount}
                      onChange={(e) => setEditSaleData(prev => ({ ...prev, mobile_amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditSaleModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  Update Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
