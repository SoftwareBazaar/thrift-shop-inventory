import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const Reports: React.FC = () => {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });

  // Report Data State
  const [inventoryStats, setInventoryStats] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [stallStatsData, setStallStatsData] = useState<any[]>([]);
  const [topSellersData, setTopSellersData] = useState<any[]>([]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

  const tabs = [
    { id: 'inventory', name: 'Inventory Report', icon: '📦' },
    { id: 'sales', name: 'Sales Report', icon: '💰' },
    ...(user?.role === 'admin' ? [
      { id: 'stall-performance', name: 'Stall Performance', icon: '📊' },
      { id: 'top-sellers', name: 'Top Sellers', icon: '🏆' },
      { id: 'backup', name: 'Data Backup', icon: '💾' }
    ] : [])
  ];

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const response = await dataApi.getInventory();
        const items = response.items || [];
        const categories: any = {};
        items.forEach((item: any) => {
          const cat = item.category || 'Other';
          categories[cat] = (categories[cat] || 0) + (item.current_stock * (item.buying_price || 0));
        });
        setInventoryStats(
          Object.entries(categories)
            .map(([name, value]) => ({ name, value: Number(value) }))
            .sort((a, b) => b.value - a.value)
        );
      } else if (activeTab === 'sales') {
        const response = await dataApi.getSales();
        let sales = response.sales || [];
        if (dateRange.start_date && dateRange.end_date) {
          sales = sales.filter((s: any) => {
            const date = s.sale_date.split('T')[0];
            return date >= dateRange.start_date && date <= dateRange.end_date;
          });
        }
        const dates: any = {};
        sales.forEach((sale: any) => {
          const rawDate = sale.date_time || sale.sale_date;
          if (!rawDate) return;
          const date = rawDate.split('T')[0];
          dates[date] = (dates[date] || 0) + (sale.total_amount || 0);
        });
        setSalesTrends(Object.entries(dates)
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date)));
      } else if (activeTab === 'stall-performance') {
        const response = await dataApi.getSales();
        let sales = response.sales || [];
        if (dateRange.start_date && dateRange.end_date) {
          sales = sales.filter((s: any) => {
            const date = s.sale_date.split('T')[0];
            return date >= dateRange.start_date && date <= dateRange.end_date;
          });
        }
        const stalls: any = {};
        sales.forEach((sale: any) => {
          const stall = sale.stall_name || 'Unknown';
          if (!stalls[stall]) stalls[stall] = { name: stall, revenue: 0 };
          stalls[stall].revenue += Number(sale.total_amount) || 0;
        });
        setStallStatsData(Object.values(stalls).sort((a: any, b: any) => b.revenue - a.revenue));
      } else if (activeTab === 'top-sellers') {
        const response = await dataApi.getSales();
        let sales = response.sales || [];
        if (dateRange.start_date && dateRange.end_date) {
          sales = sales.filter((s: any) => {
            const date = s.sale_date.split('T')[0];
            return date >= dateRange.start_date && date <= dateRange.end_date;
          });
        }
        const itemsMap: any = {};
        sales.forEach((sale: any) => {
          const name = sale.item_name || 'Unknown';
          if (!itemsMap[name]) itemsMap[name] = { name, quantity: 0 };
          itemsMap[name].quantity += Number(sale.quantity_sold || sale.quantity) || 0;
        });
        setTopSellersData(Object.values(itemsMap)
          .sort((a: any, b: any) => b.quantity - a.quantity)
          .slice(0, 10));
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExportPDF = async (reportName: string) => {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.setFontSize(18);
      pdf.text(`Street Thrift Apparel - ${reportName}`, 15, 15);
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, 15, 22);
      pdf.addImage(imgData, 'PNG', 10, 30, pdfWidth - 20, pdfHeight - 20);
      pdf.save(`${reportName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF Export error:', error);
      alert('❌ PDF export failed. Ensure jspdf and html2canvas are installed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType: string, format: 'excel' | 'pdf') => {
    if (format === 'pdf') {
      const tabName = tabs.find(t => t.id === reportType)?.name || 'Report';
      return handleExportPDF(tabName);
    }
    setLoading(true);
    try {
      let csvContent = '';
      if (reportType === 'inventory') {
        const response = await dataApi.getInventory();
        const items = response.items || [];
        csvContent = 'Item ID,Item Name,Category,Current Stock,Buying Price,Selling Price,Stock Value\n';
        items.forEach((item: any) => {
          const val = (item.current_stock || 0) * (item.buying_price || 0);
          csvContent += `${item.item_id},"${item.item_name}","${item.category}",${item.current_stock},${item.buying_price},${item.unit_price},${val.toFixed(2)}\n`;
        });
      } else if (reportType === 'sales') {
        const response = await dataApi.getSales();
        let sales = response.sales || [];
        csvContent = 'Date,Item Name,Quantity,Total Amount,Payment Method,Stall\n';
        sales.forEach((s: any) => {
          csvContent += `"${s.sale_date}","${s.item_name}",${s.quantity},${s.total_amount},"${s.payment_method}","${s.stall_name}"\n`;
        });
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupAll = async () => {
    setLoading(true);
    try {
      const [u, i, s, st] = await Promise.all([dataApi.getUsers(), dataApi.getInventory(), dataApi.getSales(), dataApi.getStalls()]);
      const data = { users: u.users, items: i.items, sales: s.sales, stalls: st.stalls, timestamp: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${new Date().toISOString().split('T')[0]}.json`);
      link.click();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const setDateRangePreset = (preset: string) => {
    const today = new Date();
    let start = '';
    const end = today.toISOString().split('T')[0];
    if (preset === 'today') start = end;
    else if (preset === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0];
    } else if (preset === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0];
    }
    setDateRange({ start_date: start, end_date: end });
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-500">Business performance and data management</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Filter Date Range</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="date" value={dateRange.start_date} onChange={e => setDateRange(p => ({ ...p, start_date: e.target.value }))} className="px-3 py-2 border rounded-lg" />
          <input type="date" value={dateRange.end_date} onChange={e => setDateRange(p => ({ ...p, end_date: e.target.value }))} className="px-3 py-2 border rounded-lg" />
          <select onChange={e => setDateRangePreset(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Quick Presets</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/50">
          <nav className="flex space-x-4 px-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
              >
                {tab.icon} {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Inventory Value Distribution</h3>
                <div className="flex space-x-2">
                  <button onClick={() => handleExport('inventory', 'excel')} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export CSV'}</button>
                  <button onClick={() => handleExport('inventory', 'pdf')} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export PDF'}</button>
                </div>
              </div>
              <div ref={reportRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-80 bg-gray-50 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inventoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                        {inventoryStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `KSh ${v.toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <div className="bg-blue-600 text-white p-6 rounded-xl">
                    <p className="text-blue-100 text-sm">Total Inventory Value</p>
                    <p className="text-3xl font-bold">KSh {inventoryStats.reduce((a, b) => a + b.value, 0).toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {inventoryStats.slice(0, 4).map((s, i) => (
                      <div key={i} className="p-4 border rounded-xl">
                        <p className="text-xs text-gray-500 uppercase">{s.name}</p>
                        <p className="text-lg font-bold">KSh {s.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Revenue Trends</h3>
                <div className="flex space-x-2">
                  <button onClick={() => handleExport('sales', 'excel')} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export CSV'}</button>
                  <button onClick={() => handleExport('sales', 'pdf')} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export PDF'}</button>
                </div>
              </div>
              <div ref={reportRef} className="space-y-6">
                <div className="h-80 bg-gray-50 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(v: any) => `KSh ${v.toLocaleString()}`} />
                      <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-900 text-white p-6 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm">Period Total Revenue</p>
                    <p className="text-3xl font-bold">KSh {salesTrends.reduce((a, b) => a + b.amount, 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Sales Count</p>
                    <p className="text-xl font-bold">{salesTrends.length} Days</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stall-performance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Stall Revenue Performance</h3>
                <div className="flex space-x-2">
                  <button onClick={() => handleExport('stall-performance', 'pdf')} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export PDF'}</button>
                </div>
              </div>
              <div ref={reportRef} className="h-80 bg-gray-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stallStatsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => `KSh ${v.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'top-sellers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Top Selling Items</h3>
                <div className="flex space-x-2">
                  <button onClick={() => handleExport('top-sellers', 'pdf')} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? '...' : 'Export PDF'}</button>
                </div>
              </div>
              <div ref={reportRef} className="h-96 bg-gray-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSellersData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-8">
              <div className="bg-blue-50 border border-blue-100 p-8 rounded-2xl flex items-start space-x-6">
                <div className="bg-blue-600 p-4 rounded-xl text-white text-2xl">💾</div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">System Backup</h4>
                  <p className="text-gray-600 mt-2 max-w-lg">Download a complete snapshot of users, inventory, and sales data as a portable JSON file.</p>
                  <button onClick={handleBackupAll} disabled={loading} className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">{loading ? 'Preparing...' : 'Download Backup'}</button>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-2xl">
                <h4 className="font-bold text-yellow-800">⚠️ Data Security Reminder</h4>
                <p className="text-sm text-yellow-700 mt-1">Backups contain sensitive business information. Store them in a secure physical or cloud location.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
