import React, { useState } from 'react';
import { useAuth } from '../contexts/MockAuthContext';

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
      { id: 'credit-sales', name: 'Credit Sales', icon: '💳' }
    ] : [])
  ];

  const handleExport = async (reportType: string, format: 'excel' | 'pdf') => {
    setLoading(true);
    try {
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create mock export data
      const mockData = `Mock ${reportType} report data for ${dateRange.start_date} to ${dateRange.end_date}`;
      const blob = new Blob([mockData], { type: 'text/plain' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      link.setAttribute('download', `${reportType}_report.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`${reportType} report exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
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
        <h1 className="text-2xl font-bold" style={{color: 'var(--primary-800)'}}>Reports & Analytics</h1>
        <p style={{color: 'var(--neutral-600)'}}>Generate and export various business reports</p>
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
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
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
        </div>
      </div>
    </div>
  );
};

export default Reports;
