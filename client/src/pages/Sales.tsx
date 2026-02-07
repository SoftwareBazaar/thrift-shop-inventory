import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/MockAuthContext';
import { dataApi } from '../services/dataService';

interface Sale {
  sale_id: number;
  item_name: string;
  category: string;
  item_id?: number;
  stall_id?: number;
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
  due_date?: string | null;
  notes?: string | null;
  buying_price?: number;
  payment_status?: string;
  balance_due?: number;
  amount_paid?: number | null;
}

interface Stall {
  stall_id: number;
  stall_name: string;
  location: string;
  manager: string;
}

interface InventoryItem {
  item_id: number;
  item_name: string;
  category: string;
  unit_price: number;
  current_stock: number;
}

interface EditFormState {
  sale_id: number;
  item_id: number | '';
  stall_id: number | '';
  quantity_sold: string;
  unit_price: string;
  sale_type: 'cash' | 'credit' | 'mobile' | 'split';
  cash_amount: string;
  mobile_amount: string;
  customer_name: string;
  customer_contact: string;
  due_date: string;
  notes: string;
}

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedStall, setSelectedStall] = useState<number | ''>('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [servedByFilter, setServedByFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string>('');

  useEffect(() => {
    fetchSales();
    fetchStalls();
    fetchItems();
    fetchUsers();

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

  const fetchItems = async () => {
    try {
      const response = await dataApi.getInventory();
      const fetchedItems = response.items || [];
      setItems(fetchedItems);
      const uniqueCategories = [...new Set(fetchedItems.map(item => item.category))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await dataApi.getUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('Error fetching users:', error);
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

    if (categoryFilter && sale.category !== categoryFilter) return false;

    // Filter by sale type
    if (saleTypeFilter && sale.sale_type !== saleTypeFilter) return false;

    // Filter by served by (recorded_by_name)
    if (servedByFilter && sale.recorded_by_name !== servedByFilter) return false;

    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi'
    });
  };

  const handleDelete = async (saleId: number) => {
    if (user?.role !== 'admin') return;
    if (!window.confirm('Are you sure you want to delete this sale? This will restore the item stock.')) return;

    try {
      await dataApi.deleteSale(saleId);
      await fetchSales();
      await fetchItems(); // Refresh items to show updated stock
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Failed to delete sale');
    }
  };

  const openEditModal = (sale: Sale) => {
    if (user?.role !== 'admin') return;
    setEditError('');
    setEditForm({
      sale_id: sale.sale_id,
      item_id: sale.item_id ?? '',
      stall_id: sale.stall_id ?? '',
      quantity_sold: sale.quantity_sold.toString(),
      unit_price: sale.unit_price.toString(),
      sale_type: sale.sale_type,
      cash_amount: sale.cash_amount != null ? sale.cash_amount.toString() : '',
      mobile_amount: sale.mobile_amount != null ? sale.mobile_amount.toString() : '',
      customer_name: sale.customer_name || '',
      customer_contact: sale.customer_contact || '',
      due_date: sale.due_date ? sale.due_date.split('T')[0] : '',
      notes: sale.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditForm(null);
    setSavingEdit(false);
    setEditError('');
  };

  const updateEditForm = (field: keyof EditFormState, value: string | number | '') => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSaleTypeChange = (value: 'cash' | 'credit' | 'mobile' | 'split') => {
    if (!editForm) return;
    setEditForm(prev => prev ? {
      ...prev,
      sale_type: value,
      cash_amount: value === 'split' ? prev.cash_amount : '',
      mobile_amount: value === 'split' ? prev.mobile_amount : '',
      customer_name: value === 'credit' ? prev.customer_name : '',
      customer_contact: value === 'credit' ? prev.customer_contact : '',
      due_date: value === 'credit' ? prev.due_date : '',
      notes: value === 'credit' ? prev.notes : ''
    } : prev);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm) return;

    try {
      setSavingEdit(true);
      setEditError('');

      if (!editForm.item_id || !editForm.stall_id) {
        setEditError('Please select both an item and stall.');
        setSavingEdit(false);
        return;
      }

      const payload: any = {
        item_id: Number(editForm.item_id),
        stall_id: Number(editForm.stall_id),
        quantity_sold: Number(editForm.quantity_sold),
        unit_price: Number(editForm.unit_price),
        sale_type: editForm.sale_type
      };

      if (editForm.sale_type === 'split') {
        if (!editForm.cash_amount || !editForm.mobile_amount) {
          setEditError('Please provide both cash and mobile amounts for split sales.');
          setSavingEdit(false);
          return;
        }
        payload.cash_amount = Number(editForm.cash_amount);
        payload.mobile_amount = Number(editForm.mobile_amount);
        const expectedTotal = payload.quantity_sold * payload.unit_price;
        if (Math.abs((payload.cash_amount || 0) + (payload.mobile_amount || 0) - expectedTotal) > 0.01) {
          setEditError('Cash and mobile amounts must equal the total amount.');
          setSavingEdit(false);
          return;
        }
      } else {
        payload.cash_amount = null;
        payload.mobile_amount = null;
      }

      if (editForm.sale_type === 'credit') {
        if (!editForm.customer_name || !editForm.customer_contact) {
          setEditError('Customer name and contact are required for credit sales.');
          setSavingEdit(false);
          return;
        }
        payload.customer_name = editForm.customer_name;
        payload.customer_contact = editForm.customer_contact;
        payload.due_date = editForm.due_date || null;
        payload.notes = editForm.notes || null;
      } else {
        payload.customer_name = null;
        payload.customer_contact = null;
        payload.due_date = null;
        payload.notes = null;
      }

      await dataApi.updateSale(editForm.sale_id, payload);
      await fetchSales();
      await fetchItems();
      closeEditModal();
    } catch (error: any) {
      console.error('Error updating sale:', error);
      setEditError(error?.message || 'Failed to update sale. Please try again.');
    } finally {
      setSavingEdit(false);
    }
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
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--primary-800)' }}>Sales Management</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--neutral-600)' }}>View and manage sales records</p>
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
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Served By</label>
            <select
              value={servedByFilter}
              onChange={(e) => setServedByFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Users</option>
              {users.map(userItem => (
                <option key={userItem.user_id} value={userItem.full_name}>
                  {userItem.full_name} {userItem.role === 'admin' ? '(Admin)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedStall('');
                setSaleTypeFilter('');
                setCategoryFilter('');
                setServedByFilter('');
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
                  Stall Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recorded By
                </th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${sale.sale_type === 'cash'
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
                    {sale.stall_name || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.recorded_by_name}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      <button
                        onClick={() => openEditModal(sale)}
                        className="text-sm font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sale.sale_id)}
                        className="text-sm font-semibold text-red-600 hover:text-red-800 hover:underline ml-3"
                      >
                        Delete
                      </button>
                    </td>
                  )}
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

      {isEditModalOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Edit Sale</h3>
              <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-4 space-y-4">
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <select
                    value={editForm.item_id ? String(editForm.item_id) : ''}
                    onChange={(e) => updateEditForm('item_id', e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={savingEdit}
                  >
                    <option value="">Select item</option>
                    {items.map(item => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stall</label>
                  <select
                    value={editForm.stall_id ? String(editForm.stall_id) : ''}
                    onChange={(e) => updateEditForm('stall_id', e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={savingEdit}
                  >
                    <option value="">Select stall</option>
                    {stalls.map(stall => (
                      <option key={stall.stall_id} value={stall.stall_id}>{stall.stall_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Sold</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.quantity_sold}
                    onChange={(e) => updateEditForm('quantity_sold', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={savingEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.unit_price}
                    onChange={(e) => updateEditForm('unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={savingEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type</label>
                  <select
                    value={editForm.sale_type}
                    onChange={(e) => handleSaleTypeChange(e.target.value as EditFormState['sale_type'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={savingEdit}
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile">Mobile</option>
                    <option value="split">Split</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                    {formatCurrency(Number(editForm.quantity_sold || '0') * Number(editForm.unit_price || '0'))}
                  </div>
                </div>
              </div>

              {editForm.sale_type === 'split' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.cash_amount}
                      onChange={(e) => updateEditForm('cash_amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={savingEdit}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.mobile_amount}
                      onChange={(e) => updateEditForm('mobile_amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={savingEdit}
                      required
                    />
                  </div>
                </div>
              )}

              {editForm.sale_type === 'credit' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editForm.customer_name}
                        onChange={(e) => updateEditForm('customer_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={savingEdit}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Contact</label>
                      <input
                        type="text"
                        value={editForm.customer_contact}
                        onChange={(e) => updateEditForm('customer_contact', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={savingEdit}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => updateEditForm('due_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={savingEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => updateEditForm('notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={savingEdit}
                      />
                    </div>
                  </div>
                  {(() => {
                    const currentSale = sales.find(s => s.sale_id === editForm.sale_id);
                    if (!currentSale || currentSale.sale_type !== 'credit') return null;
                    return (
                      <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-sm text-blue-700">
                        <p><strong>Payment Status:</strong> {currentSale.payment_status || 'unpaid'}</p>
                        <p><strong>Amount Paid:</strong> {formatCurrency(currentSale.amount_paid || 0)}</p>
                        <p><strong>Balance Due:</strong> {formatCurrency(currentSale.balance_due || 0)}</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
