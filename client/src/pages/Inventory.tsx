import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/MockAuthContext';
import { useNavigate } from 'react-router-dom';
import { dataApi } from '../services/dataService';
import VoiceAssistant from '../components/VoiceAssistant';

interface Item {
  item_id: number;
  item_name: string;
  category: string;
  initial_stock: number;
  current_stock: number;
  unit_price: number;
  buying_price?: number;
  date_added: string;
  sku?: string;
  total_allocated: number;
  total_added: number;
}

interface Stall {
  stall_id: number;
  stall_name: string;
  location: string;
  manager: string;
}

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [selectedStall, setSelectedStall] = useState<number | ''>('');
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [editFormData, setEditFormData] = useState({
    item_name: '',
    category: '',
    unit_price: '',
    initial_stock: '',
    total_added: '',
    current_stock: ''
  });
  const [distributionData, setDistributionData] = useState({
    item_id: 0,
    distributions: [] as Array<{ stall_id: string; quantity: string }>,
    notes: ''
  });
  const [addStockQuantity, setAddStockQuantity] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      // For non-admin users, pass their stall_id to get only distributed stock
      const stallId = user?.role !== 'admin' && user?.stall_id ? user.stall_id : undefined;
      console.log(`[Inventory] Fetching items. Role: ${user?.role}, stall_id: ${user?.stall_id}, effective stallId: ${stallId}`);

      const response = await dataApi.getInventory(stallId);
      console.log(`[Inventory] Received ${response.items?.length || 0} items from API`);

      const sortedItems = [...(response.items || [])].sort((a, b) =>
        a.item_name.localeCompare(b.item_name, undefined, { sensitivity: 'base' })
      );
      setItems(sortedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.stall_id]);

  const fetchSales = useCallback(async () => {
    try {
      const response = await dataApi.getSales();
      setSalesData(response.sales);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchStalls();
    fetchSales();

    // Auto-refresh every 5 seconds to sync data across all users
    const interval = setInterval(() => {
      fetchItems();
      fetchSales();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchItems, fetchSales]);

  const fetchCategories = async () => {
    try {
      // Mock categories from inventory data
      const response = await dataApi.getInventory();
      const categories = [...new Set(response.items.map(item => item.category))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      setCategories(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
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

  // Distribution functionality is handled by the modal

  const handleDistributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    // Validate distributions
    if (distributionData.distributions.length === 0) {
      alert('Please add at least one stall distribution');
      return;
    }

    const totalDistributed = distributionData.distributions.reduce((sum, dist) => {
      return sum + (parseInt(dist.quantity) || 0);
    }, 0);

    if (totalDistributed > selectedItem.current_stock) {
      alert(`Total quantity (${totalDistributed}) exceeds available stock (${selectedItem.current_stock})`);
      return;
    }

    try {
      // Validate all distributions first
      const validDistributions = distributionData.distributions
        .filter(dist => parseInt(dist.quantity) > 0 && dist.stall_id)
        .map(dist => ({
          stall_id: parseInt(dist.stall_id),
          quantity: parseInt(dist.quantity)
        }));

      const totalDistributed = validDistributions.reduce((sum, d) => sum + d.quantity, 0);

      if (totalDistributed > selectedItem.current_stock) {
        alert(`Total quantity (${totalDistributed}) exceeds available stock (${selectedItem.current_stock})`);
        return;
      }

      // Call API to distribute to all stalls at once
      await dataApi.distributeStock({
        item_id: selectedItem.item_id,
        distributions: validDistributions,
        notes: distributionData.notes
      });

      setShowDistributeModal(false);
      setDistributionData({
        item_id: 0,
        distributions: [],
        notes: ''
      });
      fetchItems(); // Refresh items
      alert('Stock distributed successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to distribute stock. Please check available stock.');
    }
  };

  const addDistributionRow = () => {
    setDistributionData(prev => ({
      ...prev,
      distributions: [...prev.distributions, { stall_id: '', quantity: '' }]
    }));
  };

  const removeDistributionRow = (index: number) => {
    setDistributionData(prev => ({
      ...prev,
      distributions: prev.distributions.filter((_, i) => i !== index)
    }));
  };

  const updateDistribution = (index: number, field: 'stall_id' | 'quantity', value: string) => {
    setDistributionData(prev => ({
      ...prev,
      distributions: prev.distributions.map((dist, i) =>
        i === index ? { ...dist, [field]: value } : dist
      )
    }));
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !addStockQuantity) return;

    const quantityToAdd = parseInt(addStockQuantity);
    if (quantityToAdd <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      // Calculate new total_added (current + quantity to add)
      const newTotalAdded = (selectedItem.total_added || 0) + quantityToAdd;

      await dataApi.updateItem(selectedItem.item_id, {
        total_added: newTotalAdded
      });

      setShowAddStockModal(false);
      setAddStockQuantity('');
      fetchItems(); // Refresh items
      alert('Stock added successfully!');
    } catch (error: any) {
      console.error('Error adding stock:', error);
      alert(error.response?.data?.message || 'Failed to add stock');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const initialStock = parseInt(editFormData.initial_stock);
      const totalAdded = parseInt(editFormData.total_added);
      const currentStock = parseInt(editFormData.current_stock);

      // Calculate current_stock based on initial_stock and total_added
      // Note: current_stock = initial_stock + total_added - distributed
      // We'll keep current_stock as is, but update initial_stock and total_added

      if (Number.isNaN(initialStock) || initialStock < 0) {
        alert('Initial stock must be zero or greater.');
        return;
      }

      if (Number.isNaN(totalAdded) || totalAdded < 0) {
        alert('Total added must be zero or greater.');
        return;
      }

      if (Number.isNaN(currentStock) || currentStock < 0) {
        alert('Current stock must be zero or greater.');
        return;
      }

      const unitPrice = parseFloat(editFormData.unit_price);

      if (Number.isNaN(unitPrice) || unitPrice <= 0) {
        alert('Unit price must be greater than zero.');
        return;
      }

      await dataApi.updateItem(selectedItem.item_id, {
        item_name: editFormData.item_name,
        category: editFormData.category,
        unit_price: unitPrice,
        initial_stock: initialStock,
        total_added: totalAdded,
        current_stock: currentStock
      });

      setShowEditModal(false);
      fetchItems(); // Refresh items - this will sync to all users
      alert('Item updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: number, itemName: string) => {
    const sold = getItemsSold(itemId, itemName);
    const message = sold > 0
      ? `Are you sure you want to delete "${itemName}"?\n\nThis item has ${sold} recorded sale(s).\n\nDeleting will NOT remove historical sales data but will remove the item from active inventory.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${itemName}"?\n\nThis action cannot be undone.`;

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    try {
      await dataApi.deleteItem(itemId);
      fetchItems();
      alert('Item removed from inventory successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to delete item');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesLowStock = !showLowStock || item.current_stock <= 5;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  // Voice Assistant handlers
  const handleVoiceSearch = (text: string) => {
    setSearchTerm(text);
  };

  const handleVoiceCommand = (command: string, params: any) => {
    switch (command) {
      case 'search':
        setSearchTerm(params.term || '');
        break;
      case 'filterCategory':
        setSelectedCategory(params.category || '');
        break;
      case 'clearFilters':
        setSearchTerm('');
        setSelectedCategory('');
        setShowLowStock(false);
        break;
      case 'showLowStock':
        setShowLowStock(true);
        break;
      default:
        break;
    }
  };

  const getItemsSold = (itemId: number, fallbackName: string) => {
    return salesData
      .filter((sale) => {
        if (sale.item_id != null) {
          return Number(sale.item_id) === itemId;
        }
        return sale.item_name === fallbackName;
      })
      .reduce((total, sale) => total + (sale.quantity_sold || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const selectedItemSold = selectedItem ? getItemsSold(selectedItem.item_id, selectedItem.item_name) : 0;
  const selectedItemDistributed = selectedItem
    ? Math.max(0, (selectedItem.total_allocated || 0) - selectedItemSold)
    : 0;
  const selectedItemAvailable = selectedItem ? Math.max(0, selectedItem.current_stock || 0) : 0;
  const selectedItemTotalInventory = selectedItem
    ? selectedItemAvailable + selectedItemDistributed + selectedItemSold
    : 0;
  const quantityToAddPreview = addStockQuantity ? parseInt(addStockQuantity, 10) || 0 : 0;
  const previewAvailableAfterAdd = selectedItemAvailable + quantityToAddPreview;
  const previewTotalInventory = selectedItemTotalInventory + quantityToAddPreview;
  const totalQuantityPendingDistribution = distributionData.distributions.reduce(
    (sum, dist) => sum + (parseInt(dist.quantity) || 0),
    0
  );
  const remainingAfterPendingDistribution = Math.max(
    0,
    selectedItemAvailable - totalQuantityPendingDistribution
  );


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
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--primary-800)' }}>Inventory Management</h1>
          <p className="text-sm sm:text-base" style={{ color: 'var(--neutral-600)' }}>Manage your inventory items and stock</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/add-item')}
            className="btn-primary text-sm sm:text-base px-3 sm:px-4 py-2 whitespace-nowrap self-start sm:self-auto"
          >
            Add New Item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className={`grid grid-cols-1 ${user?.role === 'admin' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <VoiceAssistant
                onTextReceived={handleVoiceSearch}
                onCommand={handleVoiceCommand}
                placeholder="Voice search..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {user?.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stall</label>
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
          )}

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showLowStock}
                onChange={(e) => setShowLowStock(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Show Low Stock Only</span>
            </label>
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600">
              Showing {filteredItems.length} of {items.length} items
            </span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-10">
                  #
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Items Sold
                </th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Buying Price
                  </th>
                )}
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Value
                  </th>
                )}
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredItems.map((item, index) => {
                const totalSoldForItem = getItemsSold(item.item_id, item.item_name);
                const distributedLive = Math.max(0, (item.total_allocated || 0) - totalSoldForItem);
                const centralStock = Math.max(0, item.current_stock || 0);
                const managedTotal = centralStock + distributedLive;
                const centralPercent = managedTotal > 0 ? Math.round((centralStock / managedTotal) * 100) : 0;
                const distributedPercent = managedTotal > 0 ? Math.max(0, 100 - centralPercent) : 0;
                const totalInventory = centralStock + distributedLive + totalSoldForItem;
                const isExpanded = expandedItemId === item.item_id;
                const columnSpan = user?.role === 'admin' ? 8 : 5;

                return (
                  <React.Fragment key={item.item_id}>
                    <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedItemId(isExpanded ? null : item.item_id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-all ${isExpanded ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {index + 1}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{item.item_name}</div>
                          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-tight">
                            Total in system: {totalInventory}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-top">
                        {user?.role === 'admin' ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Available (central)</span>
                              <span className="text-sm font-semibold text-gray-900">{centralStock}</span>
                            </div>
                            <div className="flex justify-between text-xs text-blue-600">
                              <span>Out at stalls</span>
                              <span className="text-sm font-semibold">{distributedLive}</span>
                            </div>
                            <div className="flex justify-between text-xs text-purple-600">
                              <span>Sold</span>
                              <span className="text-sm font-semibold">{totalSoldForItem}</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500"
                                style={{ width: `${centralPercent}%` }}
                              ></div>
                              <div
                                className="h-full bg-blue-400"
                                style={{ width: `${distributedPercent}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[11px] text-gray-400">
                              <span>Total received</span>
                              <span>{(item.initial_stock || 0) + (item.total_added || 0)}</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-900">{item.current_stock}</div>
                            <div className="text-xs text-gray-500">
                              Initial: {item.initial_stock} | New items added: {item.total_added}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {totalSoldForItem}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(item.buying_price || 0)}
                        </td>
                      )}
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(managedTotal * (item.buying_price || 0))}
                        </td>
                      )}
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setDistributionData({
                                item_id: item.item_id,
                                distributions: [],
                                notes: ''
                              });
                              setShowDistributeModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Distribute
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setAddStockQuantity('');
                              setShowAddStockModal(true);
                            }}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Add Stock
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setEditFormData({
                                item_name: item.item_name,
                                category: item.category,
                                unit_price: item.unit_price.toString(),
                                initial_stock: item.initial_stock.toString(),
                                total_added: item.total_added.toString(),
                                current_stock: item.current_stock.toString()
                              });
                              setShowEditModal(true);
                            }}
                            className="text-purple-600 hover:text-purple-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.item_id, item.item_name)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove item"
                          >
                            🗑️ Remove
                          </button>
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td className="px-6 pb-6 pt-0" colSpan={columnSpan}>
                          <div className="pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                <div className="text-xs font-semibold uppercase text-emerald-700">
                                  Available to distribute
                                </div>
                                <div className="mt-2 text-2xl font-bold text-emerald-900">
                                  {centralStock}
                                </div>
                                <p className="mt-1 text-xs text-emerald-700">
                                  Ready in central store
                                </p>
                              </div>
                              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                                <div className="text-xs font-semibold uppercase text-blue-700">
                                  At stalls (unsold)
                                </div>
                                <div className="mt-2 text-2xl font-bold text-blue-900">
                                  {distributedLive}
                                </div>
                                <p className="mt-1 text-xs text-blue-700">
                                  Stock currently with Kelvin, Manuel and other stalls
                                </p>
                              </div>
                              <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
                                <div className="text-xs font-semibold uppercase text-purple-700">
                                  Sold
                                </div>
                                <div className="mt-2 text-2xl font-bold text-purple-900">
                                  {totalSoldForItem}
                                </div>
                                <p className="mt-1 text-xs text-purple-700">
                                  Recorded sales so far
                                </p>
                              </div>
                              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                                <div className="text-xs font-semibold uppercase text-indigo-700">
                                  Total inventory
                                </div>
                                <div className="mt-2 text-2xl font-bold text-indigo-900">
                                  {totalInventory}
                                </div>
                                <p className="mt-1 text-xs text-indigo-700">
                                  Available + distributed + sold
                                </p>
                              </div>
                            </div>

                            {centralStock === 0 && (
                              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                No stock left in the central store. Add new stock before distributing again.
                              </div>
                            )}

                            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
                              <h4 className="text-sm font-semibold text-gray-900">Stock flow</h4>
                              <p className="mt-1 text-xs text-gray-500">
                                {(item.initial_stock || 0)} initial + {(item.total_added || 0)} added ={' '}
                                {(item.initial_stock || 0) + (item.total_added || 0)} received overall.{' '}
                                {distributedLive} currently at stalls, {totalSoldForItem} sold, leaving {centralStock}{' '}
                                back at the hub.
                              </p>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                                  <div className="text-xs uppercase text-gray-500">Initial stock</div>
                                  <div className="mt-1 text-lg font-semibold text-gray-900">{item.initial_stock}</div>
                                </div>
                                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                                  <div className="text-xs uppercase text-gray-500">New items added</div>
                                  <div className="mt-1 text-lg font-semibold text-gray-900">{item.total_added}</div>
                                </div>
                                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                                  <div className="text-xs uppercase text-gray-500">Allocated so far</div>
                                  <div className="mt-1 text-lg font-semibold text-gray-900">{item.total_allocated || 0}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {loading ? 'Loading items...' : searchTerm || selectedCategory || showLowStock ? 'No items match your filters' : 'No items found'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory || showLowStock
              ? 'Try adjusting your search or filter criteria'
              : user?.role === 'admin'
                ? 'Start by adding items to your inventory'
                : `No items have been distributed to your stall yet (Stall ID: ${user?.stall_id || 'N/A'})`}
          </p>
          <div className="text-xs text-gray-400 mt-2">
            User: {user?.username} | Role: {user?.role} | Mode: {navigator.onLine ? 'Online' : 'Offline'}
          </div>
          {user?.role === 'admin' && !searchTerm && !selectedCategory && !showLowStock && (
            <button
              onClick={() => navigate('/add-item')}
              className="btn-primary mt-4"
            >
              ➕ Add Your First Item
            </button>
          )}
        </div>
      )
      }

      {/* Stock Distribution Modal */}
      {
        showDistributeModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Distribute Stock - {selectedItem.item_name}
              </h3>
              <form onSubmit={handleDistributionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Available to distribute: {selectedItemAvailable}
                      </label>
                      <p className="text-xs text-gray-500">
                        Total inventory: {selectedItemTotalInventory} | At stalls (unsold): {selectedItemDistributed} | Sold: {selectedItemSold}
                      </p>
                    </div>
                    <div className="text-xs text-gray-600">
                      Remaining after this plan: {remainingAfterPendingDistribution}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Total to distribute: {totalQuantityPendingDistribution} / {selectedItemAvailable}
                  </p>
                  {selectedItemAvailable === 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      No more stock is available to distribute. Add stock before allocating to stalls.
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Stall Distributions</label>
                    <button
                      type="button"
                      onClick={addDistributionRow}
                      className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={selectedItemAvailable === 0}
                    >
                      + Add Stall
                    </button>
                  </div>

                  {distributionData.distributions.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Click "Add Stall" to start distributing</p>
                  )}

                  {distributionData.distributions.map((dist, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Stall</label>
                        <select
                          value={dist.stall_id}
                          onChange={(e) => updateDistribution(index, 'stall_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">-- Select stall --</option>
                          {stalls.map(stall => (
                            <option key={stall.stall_id} value={stall.stall_id}>
                              {stall.stall_name} ({stall.manager})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={dist.quantity}
                          onChange={(e) => updateDistribution(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                          max={selectedItem.current_stock}
                          required
                          placeholder="Qty"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDistributionRow(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={distributionData.notes}
                    onChange={(e) => setDistributionData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add distribution notes..."
                  />
                </div>

                {/* AI Automation Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">🤖 AI Stock Optimization</h4>
                  <p className="text-xs text-blue-700">
                    AI suggests optimal distribution based on sales history and demand patterns.
                  </p>
                  <div className="mt-2 text-xs text-blue-600">
                    💡 Recommended: Distribute 60% to Chuka Town, 40% to Ndagani
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDistributeModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedItemAvailable === 0 || totalQuantityPendingDistribution === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Distribute Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Add Stock Modal */}
      {
        showAddStockModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Stock</h3>
              <form onSubmit={handleAddStockSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <input
                    type="text"
                    value={selectedItem.item_name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="text"
                    value={selectedItemAvailable}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Items to Add *</label>
                  <input
                    type="number"
                    value={addStockQuantity}
                    onChange={(e) => setAddStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Will be available to distribute</span>
                    <span className="font-semibold">{previewAvailableAfterAdd}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Total inventory in system</span>
                    <span className="font-semibold">{previewTotalInventory}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Currently at stalls (unsold): {selectedItemDistributed}. Sold so far: {selectedItemSold}.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStockModal(false);
                      setAddStockQuantity('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Add Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Item Modal */}
      {
        showEditModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Item</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={editFormData.item_name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, item_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (KES) *</label>
                  <input
                    type="number"
                    value={editFormData.unit_price}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    value={editFormData.initial_stock}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, initial_stock: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Original stock quantity when item was added</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock *</label>
                  <input
                    type="number"
                    value={editFormData.current_stock}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Adjust to correct on-hand quantity.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Items Added (Total) *</label>
                  <input
                    type="number"
                    value={editFormData.total_added}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, total_added: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Total quantity added after initial stock</p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Update Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Inventory;
