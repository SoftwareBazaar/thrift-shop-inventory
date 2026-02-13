import React, { useState } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';

const Reports: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });

  const tabs = [
    { id: 'inventory', name: 'Inventory Report', icon: '📦' },
    { id: 'sales', name: 'Sales Report', icon: '💰' },
    ...(user?.role === 'admin' ? [
      { id: 'stall-performance', name: 'Stall Performance', icon: '📊' },
      { id: 'top-sellers', name: 'Top Sellers', icon: '🏆' },
      { id: 'credit-sales', name: 'Credit Sales', icon: '💳' },
      { id: 'backup', name: 'Data Backup', icon: '💾' }
    ] : [])
  ];

  // Data Backup & Restore
  const handleBackupAll = async () => {
    setLoading(true);
    try {
      const [usersResponse, itemsResponse, salesResponse, stallsResponse] = await Promise.all([
        dataApi.getUsers(),
        dataApi.getInventory(),
        dataApi.getSales(),
        dataApi.getStalls()
      ]);

      const backupData = {
        users: usersResponse.users,
        items: itemsResponse.items,
        sales: salesResponse.sales,
        stalls: stallsResponse.stalls,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `thrift-shop-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      alert('✅ Complete backup exported successfully! Save this file securely.');
    } catch (error) {
      console.error('Backup error:', error);
      alert('❌ Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backupData = JSON.parse(text);

        if (!backupData.users || !backupData.items || !backupData.sales || !backupData.stalls) {
          alert('❌ Invalid backup file format');
          return;
        }

        if (!window.confirm('⚠️ WARNING: This will replace ALL current data. Continue?')) {
          return;
        }

        // Restore all data
        localStorage.setItem('thrift_shop_users', JSON.stringify(backupData.users));
        localStorage.setItem('thrift_shop_items', JSON.stringify(backupData.items));
        localStorage.setItem('thrift_shop_sales', JSON.stringify(backupData.sales));
        localStorage.setItem('thrift_shop_stalls', JSON.stringify(backupData.stalls));

        alert('✅ Data restored successfully! Refreshing page...');
        window.location.reload();
      } catch (error) {
        console.error('Restore error:', error);
        alert('❌ Failed to restore backup');
      }
    };
    input.click();
  };

  const handleExport = async (reportType: string, format: 'excel' | 'pdf') => {
    setLoading(true);
    try {
      let csvContent = '';
      let filename = '';

      switch (reportType) {
        case 'inventory': {
          const response = await dataApi.getInventory();
          const items = response.items || [];

          // CSV header
          csvContent = 'Item ID,Item Name,Category,SKU,Initial Stock,Current Stock,Buying Price,Selling Price,Stock Value,Date Added\n';

          // CSV rows
          items.forEach((item: any) => {
            const stockValue = (item.current_stock || 0) * (item.buying_price || item.unit_price || 0);
            csvContent += `${item.item_id || ''},"${item.item_name || ''}","${item.category || ''}","${item.sku || ''}",${item.initial_stock || 0},${item.current_stock || 0},${item.buying_price || 0},${item.unit_price || 0},${stockValue.toFixed(2)},"${item.date_added || ''}"\n`;
          });

          filename = `inventory_report_${new Date().toISOString().split('T')[0]}`;
          break;
        }

        case 'sales': {
          const response = await dataApi.getSales();
          let sales = response.sales || [];

          // Filter by date range if provided
          if (dateRange.start_date && dateRange.end_date) {
            sales = sales.filter((sale: any) => {
              const saleDate = sale.sale_date?.split('T')[0] || sale.sale_date;
              return saleDate >= dateRange.start_date && saleDate <= dateRange.end_date;
            });
          }

          // CSV header
          csvContent = 'Sale ID,Date,Item Name,Quantity,Unit Price,Total Amount,Payment Method,Payment Status,Customer Name,Served By,Stall\n';

          // CSV rows
          sales.forEach((sale: any) => {
            csvContent += `${sale.sale_id || ''},"${sale.sale_date || ''}","${sale.item_name || ''}",${sale.quantity || 0},${sale.unit_price || 0},${sale.total_amount || 0},"${sale.payment_method || ''}","${sale.payment_status || ''}","${sale.customer_name || ''}","${sale.served_by || ''}","${sale.stall_name || ''}"\n`;
          });

          filename = `sales_report_${dateRange.start_date || 'all'}_to_${dateRange.end_date || 'all'}`;
          break;
        }

        case 'stall-performance': {
          const response = await dataApi.getSales();
          let sales = response.sales || [];

          // Filter by date range
          if (dateRange.start_date && dateRange.end_date) {
            sales = sales.filter((sale: any) => {
              const saleDate = sale.sale_date?.split('T')[0] || sale.sale_date;
              return saleDate >= dateRange.start_date && saleDate <= dateRange.end_date;
            });
          }

          // Aggregate by stall
          const stallStats: any = {};
          sales.forEach((sale: any) => {
            const stall = sale.stall_name || 'Unknown';
            if (!stallStats[stall]) {
              stallStats[stall] = { totalSales: 0, totalRevenue: 0, itemCount: 0 };
            }
            stallStats[stall].totalSales += 1;
            stallStats[stall].totalRevenue += sale.total_amount || 0;
            stallStats[stall].itemCount += sale.quantity || 0;
          });

          // CSV header
          csvContent = 'Stall Name,Total Sales,Items Sold,Total Revenue,Avg Sale Value\n';

          // CSV rows
          Object.entries(stallStats).forEach(([stall, stats]: [string, any]) => {
            const avgSale = stats.totalSales > 0 ? stats.totalRevenue / stats.totalSales : 0;
            csvContent += `"${stall}",${stats.totalSales},${stats.itemCount},${stats.totalRevenue.toFixed(2)},${avgSale.toFixed(2)}\n`;
          });

          filename = `stall_performance_${dateRange.start_date || 'all'}_to_${dateRange.end_date || 'all'}`;
          break;
        }

        case 'top-sellers': {
          const response = await dataApi.getSales();
          let sales = response.sales || [];

          // Filter by date range
          if (dateRange.start_date && dateRange.end_date) {
            sales = sales.filter((sale: any) => {
              const saleDate = sale.sale_date?.split('T')[0] || sale.sale_date;
              return saleDate >= dateRange.start_date && saleDate <= dateRange.end_date;
            });
          }

          // Aggregate by item
          const itemStats: any = {};
          sales.forEach((sale: any) => {
            const itemName = sale.item_name || 'Unknown';
            if (!itemStats[itemName]) {
              itemStats[itemName] = { quantity: 0, revenue: 0, salesCount: 0 };
            }
            itemStats[itemName].quantity += sale.quantity || 0;
            itemStats[itemName].revenue += sale.total_amount || 0;
            itemStats[itemName].salesCount += 1;
          });

          // Sort by quantity sold
          const sortedItems = Object.entries(itemStats).sort((a: any, b: any) => b[1].quantity - a[1].quantity);

          // CSV header
          csvContent = 'Rank,Item Name,Quantity Sold,Total Revenue,Number of Sales,Avg Sale Value\n';

          // CSV rows
          sortedItems.forEach(([itemName, stats]: [string, any], index) => {
            const avgSale = stats.salesCount > 0 ? stats.revenue / stats.salesCount : 0;
            csvContent += `${index + 1},"${itemName}",${stats.quantity},${stats.revenue.toFixed(2)},${stats.salesCount},${avgSale.toFixed(2)}\n`;
          });

          filename = `top_sellers_${dateRange.start_date || 'all'}_to_${dateRange.end_date || 'all'}`;
          break;
        }

        case 'credit-sales': {
          const response = await dataApi.getSales();
          let sales = response.sales || [];

          // Filter credit sales
          sales = sales.filter((sale: any) => sale.payment_status !== 'paid');

          // Filter by date range
          if (dateRange.start_date && dateRange.end_date) {
            sales = sales.filter((sale: any) => {
              const saleDate = sale.sale_date?.split('T')[0] || sale.sale_date;
              return saleDate >= dateRange.start_date && saleDate <= dateRange.end_date;
            });
          }

          // CSV header
          csvContent = 'Sale ID,Date,Customer Name,Item Name,Quantity,Total Amount,Payment Status,Days Outstanding\n';

          // CSV rows
          const today = new Date();
          sales.forEach((sale: any) => {
            const saleDate = new Date(sale.sale_date);
            const daysOutstanding = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
            csvContent += `${sale.sale_id || ''},"${sale.sale_date || ''}","${sale.customer_name || ''}","${sale.item_name || ''}",${sale.quantity || 0},${sale.total_amount || 0},"${sale.payment_status || ''}",${daysOutstanding}\n`;
          });

          filename = `credit_sales_${dateRange.start_date || 'all'}_to_${dateRange.end_date || 'all'}`;
          break;
        }

        default:
          throw new Error('Unknown report type');
      }

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      alert(`✅ ${reportType} report exported successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setDateRangePreset = (preset: string) => {
    const today = new Date();
    let startDate = '';
    let endDate = today.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
    }

    setDateRange({ start_date: startDate, end_date: endDate });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--primary-800)' }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--neutral-600)' }}>Generate and export various business reports</p>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Quick Presets</label>
            <select
              onChange={(e) => setDateRangePreset(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select preset</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="year">Last year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Inventory Report */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Inventory Report</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('inventory', 'excel')}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export Excel'}
                  </button>
                  <button
                    onClick={() => handleExport('inventory', 'pdf')}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export PDF'}
                  </button>
                </div>
              </div>
              <p className="text-gray-600">
                Generate a comprehensive inventory report showing all items, stock levels, and values.
              </p>
            </div>
          )}

          {/* Sales Report */}
          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Sales Report</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('sales', 'excel')}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export Excel'}
                  </button>
                  <button
                    onClick={() => handleExport('sales', 'pdf')}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export PDF'}
                  </button>
                </div>
              </div>
              <p className="text-gray-600">
                Generate a detailed sales report for the selected date range.
              </p>
            </div>
          )}

          {/* Stall Performance Report */}
          {activeTab === 'stall-performance' && user?.role === 'admin' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Stall Performance Report</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('stall-performance', 'excel')}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export Excel'}
                  </button>
                </div>
              </div>
              <p className="text-gray-600">
                Compare performance across all stalls with detailed metrics.
              </p>
            </div>
          )}

          {/* Top Sellers Report */}
          {activeTab === 'top-sellers' && user?.role === 'admin' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Top Sellers Report</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('top-sellers', 'excel')}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export Excel'}
                  </button>
                </div>
              </div>
              <p className="text-gray-600">
                Identify your best-selling items by quantity and revenue.
              </p>
            </div>
          )}

          {/* Credit Sales Report */}
          {activeTab === 'credit-sales' && user?.role === 'admin' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Credit Sales Report</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('credit-sales', 'excel')}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exporting...' : 'Export Excel'}
                  </button>
                </div>
              </div>
              <p className="text-gray-600">
                Track all credit sales and outstanding balances.
              </p>
            </div>
          )}

          {/* Data Backup & Restore */}
          {activeTab === 'backup' && user?.role === 'admin' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Backup & Restore</h3>
                <p className="text-gray-600 mb-6">
                  Protect your business data with automatic backups. Download a complete backup or restore from a previous backup file.
                </p>
              </div>

              {/* Backup Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">💾</span>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-blue-900 mb-2">Download Complete Backup</h4>
                    <p className="text-blue-700 text-sm mb-4">
                      Export all your data (users, items, sales, stalls) to a single JSON file. This file can be restored later or transferred to another device.
                    </p>
                    <button
                      onClick={handleBackupAll}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Creating Backup...' : '💾 Download Backup Now'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Restore Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">🔄</span>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-green-900 mb-2">Restore from Backup</h4>
                    <p className="text-green-700 text-sm mb-4">
                      Restore all your data from a previously downloaded backup file. This will replace all current data.
                    </p>
                    <button
                      onClick={handleRestore}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🔄 Restore from Backup
                    </button>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-900 mb-3">⚠️ Important Notes</h4>
                <ul className="space-y-2 text-yellow-800 text-sm">
                  <li>• <strong>Backup regularly:</strong> Create backups at least once per day</li>
                  <li>• <strong>Save securely:</strong> Keep backup files in a safe location (cloud storage recommended)</li>
                  <li>• <strong>Multiple backups:</strong> Keep multiple backup copies for redundancy</li>
                  <li>• <strong>Test restore:</strong> Periodically test that your backups work by restoring</li>
                  <li>• <strong>Data loss warning:</strong> Restore will REPLACE all existing data</li>
                </ul>
              </div>

              {/* Recommended Backup Schedule */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">📅 Recommended Backup Schedule</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white p-4 rounded-lg">
                    <div className="font-semibold text-gray-900 mb-2">Daily</div>
                    <div className="text-gray-600">Critical business data</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="font-semibold text-gray-900 mb-2">Weekly</div>
                    <div className="text-gray-600">Comprehensive backup</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="font-semibold text-gray-900 mb-2">Monthly</div>
                    <div className="text-gray-600">Long-term archive</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
