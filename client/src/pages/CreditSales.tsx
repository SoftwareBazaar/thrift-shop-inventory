import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataApi } from '../services/dataService';
import type { Sale } from '../services/dataService';

const CreditSales: React.FC = () => {
  const navigate = useNavigate();
  const [creditSales, setCreditSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  // The balance is derived in the database as total - amount paid, so it can
  // only be moved by recording what the customer has actually paid.
  const [editData, setEditData] = useState({ amount_paid: 0 });
  const [saving, setSaving] = useState(false);

  const fetchCreditSales = useCallback(async () => {
    try {
      const response = await dataApi.getSales();
      const creditOnlySales = response.sales.filter(sale => sale.sale_type === 'credit');
      setCreditSales(creditOnlySales);
    } catch (error) {
      console.error('Error fetching credit sales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditSales();
  }, [fetchCreditSales]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

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

  const getPaymentStatusColor = (status?: string) => {
    switch (status) {
      case 'fully_paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary-800)' }}>Credit Sales Management</h1>
          <p style={{ color: 'var(--neutral-600)' }}>View and manage credit sales transactions</p>
        </div>
        <button
          onClick={() => navigate('/sales')}
          className="btn-secondary"
        >
          Back to Sales
        </button>
      </div>

      {/* Credit Sales Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-xl">💳</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Credit Sales</p>
              <p className="text-lg font-semibold text-gray-900">{creditSales.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <span className="text-xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Credit Amount</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(creditSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Pending Collections</p>
              <p className="text-lg font-semibold text-gray-900">
                {creditSales.filter(sale => sale.payment_status !== 'fully_paid').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recorded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {creditSales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(sale.date_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sale.customer_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.customer_contact || '-'}
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(sale.payment_status)}`}>
                      {sale.payment_status ? sale.payment_status.replace('_', ' ') : 'unpaid'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.recorded_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingSale(sale);
                        setEditData({ amount_paid: Number(sale.amount_paid) || 0 });
                        setShowEditModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Payment Status Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Record Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              {editingSale.customer_name || 'Customer'} — {formatCurrency(editingSale.total_amount)} owed in total
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;

              const paid = Number(editData.amount_paid);
              if (!Number.isFinite(paid) || paid < 0) {
                alert('Enter how much the customer has paid, as a number.');
                return;
              }
              if (paid > editingSale.total_amount) {
                alert(`That is more than the ${formatCurrency(editingSale.total_amount)} owed. Enter the total paid so far, not an extra payment on top.`);
                return;
              }

              setSaving(true);
              try {
                // Send amount_paid: the status and the remaining balance are both
                // worked out from it, so they can never disagree with the money.
                await dataApi.updateSale(editingSale.sale_id, { amount_paid: paid });
                setShowEditModal(false);
                setEditingSale(null);
                await fetchCreditSales();
              } catch (error: any) {
                alert(error?.message || 'Could not save the payment. Please try again.');
              } finally {
                setSaving(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total paid so far (KES) *
                </label>
                <input
                  type="number"
                  value={editData.amount_paid}
                  onChange={(e) => setEditData({ amount_paid: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max={editingSale.total_amount}
                  step="0.01"
                  required
                  autoFocus
                />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Balance after saving: {formatCurrency(Math.max(0, editingSale.total_amount - (Number(editData.amount_paid) || 0)))}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the running total the customer has paid, not just today's instalment.
                  The status updates itself from this amount.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingSale(null); }}
                  className="px-4 py-2 hover:opacity-70"
                  style={{ color: 'var(--neutral-600)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {creditSales.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-400 text-6xl mb-4">💳</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No credit sales recorded</h3>
          <p className="text-gray-600">Credit sales will appear here when recorded</p>
        </div>
      )}
    </div>
  );
};

export default CreditSales;

