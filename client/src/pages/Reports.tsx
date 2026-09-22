import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// The shop trades in Nairobi (UTC+3) but timestamps are stored in UTC. Slicing
// the ISO string put an early-morning sale on the previous day, so reports and
// the day filter disagreed with what the shop actually sold that day.
const SHOP_TIME_ZONE = 'Africa/Nairobi';
const shopDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Business day of a sale, as YYYY-MM-DD in shop time. */
const shopDateKey = (rawDate?: string | null): string | null => {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return shopDateFormatter.format(parsed);
};

/** Units on a sale row, tolerating either column name. */
const saleQuantity = (sale: any): number =>
  Number(sale?.quantity_sold ?? sale?.quantity ?? 0) || 0;

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

  // Applies whichever end of the range has been filled in. It previously only
  // filtered when both dates were set, so a half-filled range silently showed
  // every sale ever recorded.
  const filterByDateRange = useCallback((sales: any[]) => {
    const { start_date, end_date } = dateRange;
    if (!start_date && !end_date) return sales;

    return sales.filter((sale: any) => {
      const date = shopDateKey(sale.date_time || sale.sale_date);
      if (!date) return false;
      if (start_date && date < start_date) return false;
      if (end_date && date > end_date) return false;
      return true;
    });
  }, [dateRange]);

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
        const invResponse = await dataApi.getInventory();
        const items = invResponse.items || [];
        const salesResponse = await dataApi.getSales();
        const allSales = salesResponse.sales || [];
        const itemsSoldMap: any = {};
        allSales.forEach((s: any) => {
          itemsSoldMap[s.item_id] = (itemsSoldMap[s.item_id] || 0) + (s.quantity_sold || s.quantity || 0);
        });

        // Build stall-sales map per item (same logic as Dashboard)
        const stallSalesMap: any = {};
        allSales.forEach((s: any) => {
          if (s.stall_id != null) {
            stallSalesMap[s.item_id] = (stallSalesMap[s.item_id] || 0) + (s.quantity_sold || s.quantity || 0);
          }
        });

        const categories: any = {};
        items.forEach((item: any) => {
          const cat = item.category || 'Other';
          // Mirror Dashboard formula:
          // central stock (current_stock) + unsold distributed stock
          const centralStock = Math.max(0, Number(item.current_stock) || 0);
          const stallSold = stallSalesMap[item.item_id] || 0;
          const distributedLive = Math.max(0, (Number(item.total_allocated) || 0) - stallSold);
          const unsoldStock = centralStock + distributedLive;
          categories[cat] = (categories[cat] || 0) + (unsoldStock * (Number(item.buying_price) || 0));
        });
        setInventoryStats(
          Object.entries(categories)
            .map(([name, value]) => ({ name, value: Number(value) }))
            .sort((a, b) => b.value - a.value)
        );
      } else if (activeTab === 'sales') {
        const response = await dataApi.getSales();
        let sales = response.sales || [];
        
        // Fetch items to get buying prices for profit calculation
        const invResponse = await dataApi.getInventory();
        const items = invResponse.items || [];
        const itemsMap: any = {};
        items.forEach((item: any) => {
          itemsMap[item.item_id] = {
            buying_price: item.buying_price || 0,
            item_name: item.item_name
          };
        });
        
        sales = filterByDateRange(sales);

        const dates: any = {};
        sales.forEach((sale: any) => {
          const date = shopDateKey(sale.date_time || sale.sale_date);
          if (!date) return;

          // Quantity must come from the same helper the other tabs use. Reading
          // only quantity_sold here meant a row carrying `quantity` instead
          // counted its revenue but recorded no cost, inflating the margin.
          const quantity = saleQuantity(sale);
          const itemInfo = itemsMap[sale.item_id] || { buying_price: 0 };
          const cost = (Number(itemInfo.buying_price) || 0) * quantity;
          const revenue = Number(sale.total_amount) || 0;

          if (!dates[date]) {
            dates[date] = { revenue: 0, profit: 0, cost: 0 };
          }
          dates[date].revenue += revenue;
          dates[date].profit += revenue - cost;
          dates[date].cost += cost;
        });
        
        setSalesTrends(Object.entries(dates)
          .map(([date, data]: any) => ({ 
            date, 
            revenue: data.revenue,
            profit: data.profit,
            cost: data.cost,
            margin: data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(2) : 0
          }))
          .sort((a, b) => a.date.localeCompare(b.date)));
      } else if (activeTab === 'stall-performance') {
        const response = await dataApi.getSales();
        const sales = filterByDateRange(response.sales || []);
        const stalls: any = {};
        sales.forEach((sale: any) => {
          // Central-hub sales have no stall, so label them for what they are
          // rather than lumping them under "Unknown" beside the real stalls.
          const stall = sale.stall_id == null ? 'Central hub' : (sale.stall_name || 'Unknown');
          if (!stalls[stall]) stalls[stall] = { name: stall, revenue: 0 };
          stalls[stall].revenue += Number(sale.total_amount) || 0;
        });
        setStallStatsData(Object.values(stalls).sort((a: any, b: any) => b.revenue - a.revenue));
      } else if (activeTab === 'top-sellers') {
        const response = await dataApi.getSales();
        const sales = filterByDateRange(response.sales || []);
        const itemsMap: any = {};
        sales.forEach((sale: any) => {
          const name = sale.item_name || 'Unknown';
          if (!itemsMap[name]) itemsMap[name] = { name, quantity: 0 };
          itemsMap[name].quantity += saleQuantity(sale);
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
  }, [activeTab, filterByDateRange]);

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
        const invResponse = await dataApi.getInventory();
        const items = invResponse.items || [];
        const salesResponse = await dataApi.getSales();
        const allSales = salesResponse.sales || [];
        const stallSalesMap: any = {};
        allSales.forEach((s: any) => {
          if (s.stall_id != null) {
            stallSalesMap[s.item_id] = (stallSalesMap[s.item_id] || 0) + (s.quantity_sold || s.quantity || 0);
          }
        });
        csvContent = 'Item ID,Item Name,Category,Unsold Stock,Buying Price,Selling Price,Stock Value\n';
        items.forEach((item: any) => {
          const centralStock = Math.max(0, Number(item.current_stock) || 0);
          const stallSold = stallSalesMap[item.item_id] || 0;
          const distributedLive = Math.max(0, (Number(item.total_allocated) || 0) - stallSold);
          const unsoldStock = centralStock + distributedLive;
          const val = unsoldStock * (Number(item.buying_price) || 0);
          csvContent += `${item.item_id},"${item.item_name}","${item.category}",${unsoldStock},${item.buying_price},${item.unit_price},${val.toFixed(2)}\n`;
        });
      } else if (reportType === 'sales') {
        const response = await dataApi.getSales();
        // Honour the date filter shown on screen. The export used to write
        // every sale ever recorded, so its totals didn't match the report the
        // user was looking at when they pressed the button.
        const sales = filterByDateRange(response.sales || []);

        // Fetch items to get buying prices for profit calculation
        const invResponse = await dataApi.getInventory();
        const items = invResponse.items || [];
        const itemsMap: any = {};
        items.forEach((item: any) => {
          itemsMap[item.item_id] = {
            buying_price: item.buying_price || 0,
            item_name: item.item_name
          };
        });

        csvContent = 'Date,Item Name,Quantity,Unit Price,Total Amount,Buying Price,Profit,Payment Method,Stall\n';
        sales.forEach((s: any) => {
          const itemInfo = itemsMap[s.item_id] || { buying_price: 0 };
          const quantity = saleQuantity(s);
          const revenue = Number(s.total_amount) || 0;
          const totalProfit = revenue - (Number(itemInfo.buying_price) || 0) * quantity;
          const stallName = s.stall_id == null ? 'Central hub' : (s.stall_name || 'Unknown');
          csvContent += `"${shopDateKey(s.date_time || s.sale_date) || ''}","${s.item_name}",${quantity},${s.unit_price},${revenue},${itemInfo.buying_price},${totalProfit.toFixed(2)},"${s.payment_method || ''}","${stallName}"\n`;
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
    if (!preset) return;

    // Anchor the presets to the shop's own day. Using the UTC date meant that
    // before 3am local, "Today" selected yesterday and today's sales vanished
    // from the report.
    const now = new Date();
    const end = shopDateKey(now.toISOString())!;

    const daysBack = preset === 'today' ? 0 : preset === 'week' ? 7 : preset === 'month' ? 30 : null;
    if (daysBack === null) return;

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    setDateRange({ start_date: shopDateKey(startDate.toISOString())!, end_date: end });
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
          <nav className="flex space-x-1 px-4 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
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
              <div className="bg-blue-600 text-white px-6 py-4 rounded-xl flex justify-between items-center">
                <p className="text-blue-100 text-sm font-medium">Total Inventory Value</p>
                <p className="text-2xl font-bold">KSh {inventoryStats.reduce((a, b) => a + b.value, 0).toLocaleString()}</p>
              </div>
              <div ref={reportRef} className="bg-gray-50 rounded-xl p-4" style={{ height: `${Math.max(320, inventoryStats.length * 40)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryStats} layout="vertical" margin={{ left: 10, right: 60, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v: any) => `KSh ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => [`KSh ${v.toLocaleString()}`, 'Value']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: any) => `KSh ${v.toLocaleString()}`, fontSize: 11 }}>
                      {inventoryStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Revenue & Profit Trends</h3>
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
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Revenue" />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Profit" />
                      <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Cost" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                    <p className="text-blue-600 text-sm font-medium">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-900">KSh {salesTrends.reduce((a, b) => a + (b.revenue || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                    <p className="text-green-600 text-sm font-medium">Total Profit</p>
                    <p className="text-2xl font-bold text-green-900">KSh {salesTrends.reduce((a, b) => a + (b.profit || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                    <p className="text-red-600 text-sm font-medium">Total Cost</p>
                    <p className="text-2xl font-bold text-red-900">KSh {salesTrends.reduce((a, b) => a + (b.cost || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                    <p className="text-purple-600 text-sm font-medium">Profit Margin</p>
                    <p className="text-2xl font-bold text-purple-900">{(() => {
                      // Guard on revenue, not row count: rows that total zero
                      // revenue used to divide by zero and render "NaN%".
                      const totalRevenue = salesTrends.reduce((a, b) => a + (b.revenue || 0), 0);
                      if (totalRevenue <= 0) return '0.0';
                      const totalProfit = salesTrends.reduce((a, b) => a + (b.profit || 0), 0);
                      return ((totalProfit / totalRevenue) * 100).toFixed(1);
                    })()}%</p>
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
