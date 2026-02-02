import React, { useState, useEffect } from 'react';
import { ordersAPI, settingsAPI } from '../../utils/api';
import { Order, ShopInfo } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const OrderManagement: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    payment_method: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [voidForm, setVoidForm] = useState({
    void_reason: '',
    admin_username: '',
    admin_password: '',
  });
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    loadOrders();
  }, [filters]);

  useEffect(() => {
    const loadShopInfo = async () => {
      try {
        const response = await settingsAPI.getShopInfo();
        setShopInfo(response.data);
      } catch (err) {
        // ignore
      }
    };
    loadShopInfo();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await ordersAPI.getAll(filters);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      toast.success('Order status updated successfully');
      if (newStatus === 'completed') {
        try {
          const { data } = await ordersAPI.getById(orderId);
          if (data) {
            printReceipt(data as Order);
          }
        } catch (e) {
          // printing is best-effort
        }
      }
      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleOpenOrderDetails = async (order: Order) => {
    try {
      const { data } = await ordersAPI.getById(order.id);
      setSelectedOrder(data as Order);
    } catch (err) {
      setSelectedOrder(order);
    }
    setShowOrderDetails(true);
  };

  const formatMoney = (value: number) => `₱${value.toFixed(2)}`;

  const buildReceiptHTML = (order: Order) => {
    const businessName = shopInfo?.shop_name || 'Orijins Coffee House';
    const address = shopInfo?.shop_address || '';
    const phone = shopInfo?.shop_phone || '';
    const dateStr = new Date(order.created_at).toLocaleDateString();
    const timeStr = new Date(order.created_at).toLocaleTimeString();
    const itemsRows = (order.items || [])
      .map(
        (it) => `
        <tr>
          <td style="text-align:left">${it.quantity.toFixed(1)} x</td>
          <td style="text-align:left">${it.menu_item_name || ''}</td>
          <td style="text-align:right">${it.unit_price.toFixed(2)}</td>
          <td style="text-align:right">${it.total_price.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `<!doctype html><html><head><meta charset="utf-8" />
      <title>Receipt ${order.order_number}</title>
      <style>
        body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; margin: 0; }
        .receipt { width: 260px; padding: 12px; }
        h1 { font-size: 16px; margin: 0 0 4px 0; text-align:center; }
        .center { text-align:center; font-size:12px; }
        .muted { color:#444; }
        .sep { border-top:1px dashed #000; margin:8px 0; }
        table { width:100%; font-size:12px; border-collapse:collapse; }
        td { padding:2px 0; }
        .totals td { font-weight:bold; }
        @media print { .no-print { display:none } }
      </style>
    </head>
    <body onload="window.print(); setTimeout(()=>window.close(), 300);">
      <div class="receipt">
        <h1>${businessName}</h1>
        <div class="center muted">${address}</div>
        <div class="center muted">${phone}</div>
        <div class="sep"></div>
        <div style="font-size:12px">
          <div>INV#: <strong>${order.order_number}</strong></div>
          <div>DATE: ${dateStr} &nbsp;&nbsp; TIME: ${timeStr}</div>
        </div>
        <div class="sep"></div>
        <table>
          ${itemsRows}
        </table>
        <div class="sep"></div>
        <table class="totals">
          <tr><td style="text-align:left">SUBTOTAL</td><td style="text-align:right">${order.total_amount.toFixed(2)}</td></tr>
          <tr><td style="text-align:left">TOTAL</td><td style="text-align:right">${order.total_amount.toFixed(2)}</td></tr>
        </table>
        <div class="sep"></div>
        <div style="font-size:12px">
          <div>PAYMENT RECEIVED: <strong>${formatMoney(order.total_amount)}</strong></div>
          <div class="muted">${order.payment_method.toUpperCase()}</div>
          <div>CHANGE AMOUNT: ${formatMoney(0)}</div>
        </div>
        <div class="sep"></div>
        <div class="center">Acknowledgement Receipt<br/>Thank you!</div>
      </div>
    </body></html>`;
  };

  const printReceipt = (order: Order) => {
    try {
      const html = buildReceiptHTML(order);
      const win = window.open('', 'printwindow', 'width=320,height=600');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (_) {
      // ignore
    }
  };

  const handleVoidOrder = async () => {
    if (!selectedOrder) return;

    try {
      await ordersAPI.void(selectedOrder.id, voidForm);
      toast.success('Order voided successfully');
      setShowVoidModal(false);
      setVoidForm({ void_reason: '', admin_username: '', admin_password: '' });
      loadOrders();
    } catch (error) {
      console.error('Error voiding order:', error);
      toast.error('Failed to void order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge-warning';
      case 'in_progress':
        return 'badge-info';
      case 'ready':
        return 'badge-success';
      case 'completed':
        return 'badge-success';
      case 'voided':
        return 'badge-danger';
      default:
        return 'badge-gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="w-4 h-4" />;
      case 'in_progress':
        return <ArrowPathIcon className="w-4 h-4" />;
      case 'ready':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'voided':
        return <XMarkIcon className="w-4 h-4" />;
      default:
        return <ClockIcon className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <p className="mt-2 text-gray-600">
            Manage and track all customer orders
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="btn btn-outline"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search (press Enter to search) */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setFilters({ ...filters, search: searchInput });
                  }
                }}
                className="input pl-10"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={filters.payment_method}
              onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
              className="input"
            >
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
            </select>

            {/* Start Date Filter */}
            <div className="form-control">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="input w-full"
                placeholder="Start Date"
              />
            </div>

            {/* End Date Filter */}
            <div className="form-control">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="input w-full"
                placeholder="End Date"
              />
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => setFilters({ status: '', payment_method: '', search: '', startDate: '', endDate: '' })}
              className="btn btn-outline"
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">
            Orders ({(() => {
              const f = filters;
              const list = orders.filter((o) => {
                const matchesStatus = f.status
                  ? (f.status === 'voided'
                    ? (o.is_voided || o.status === 'voided')
                    : o.status === f.status)
                  : true;
                const matchesPayment = f.payment_method
                  ? (o.payment_method || '').toLowerCase() === f.payment_method.toLowerCase()
                  : true;
                const matchesSearch = f.search
                  ? (o.order_number?.toLowerCase().includes(f.search.toLowerCase()) ||
                    (o.customer_name || '').toLowerCase().includes(f.search.toLowerCase()))
                  : true;
                return matchesStatus && matchesPayment && matchesSearch;
              });
              return list.length;
            })()})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-compact">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Order #</th>
                <th className="table-header-cell">Customer</th>
                <th className="table-header-cell">Items</th>
                <th className="table-header-cell">Total</th>
                <th className="table-header-cell">Payment</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Time</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {orders
                .filter((o) => {
                  const f = filters;
                  const matchesStatus = f.status
                    ? (f.status === 'voided' ? (o.is_voided || o.status === 'voided') : o.status === f.status)
                    : true;
                  const matchesPayment = f.payment_method
                    ? (o.payment_method || '').toLowerCase() === f.payment_method.toLowerCase()
                    : true;
                  const matchesSearch = f.search
                    ? (o.order_number?.toLowerCase().includes(f.search.toLowerCase()) ||
                      (o.customer_name || '').toLowerCase().includes(f.search.toLowerCase()))
                    : true;
                  return matchesStatus && matchesPayment && matchesSearch;
                })
                .map((order) => (
                  <tr key={order.id} className="table-row">
                    <td className="table-cell font-mono text-sm">
                      {order.order_number}
                    </td>
                    <td className="table-cell">
                      {order.customer_name || 'Walk-in'}
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="table-cell font-medium">
                      ₱{order.total_amount.toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <span className="capitalize">{order.payment_method}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge flex items-center w-fit ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1 capitalize">{order.status}</span>
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenOrderDetails(order)}
                          className="p-2 text-gray-400 hover:text-primary-600 transition-colors duration-200"
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>

                        {/* Status Update Buttons */}
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'in_progress')}
                            className="btn btn-sm btn-primary"
                          >
                            Start
                          </button>
                        )}

                        {order.status === 'in_progress' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'ready')}
                            className="btn btn-sm btn-success"
                          >
                            Ready
                          </button>
                        )}

                        {order.status === 'ready' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'completed')}
                            className="btn btn-sm btn-success"
                          >
                            Complete
                          </button>
                        )}

                        {/* Void Button (Admin only) */}
                        {!order.is_voided && ['pending', 'in_progress'].includes(order.status) && (user?.role === 'owner' || user?.role === 'admin') && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowVoidModal(true);
                            }}
                            className="btn btn-sm btn-danger"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {orders.length === 0 && (
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600">
            {Object.values(filters).some(f => f)
              ? 'Try adjusting your filters to see more orders.'
              : 'No orders have been placed yet.'}
          </p>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Details - {selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Customer</label>
                  <p className="text-gray-900">{selectedOrder.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Payment Method</label>
                  <p className="text-gray-900 capitalize">{selectedOrder.payment_method}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Total Amount</label>
                  <p className="text-gray-900 font-medium">₱{selectedOrder.total_amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Order Time</label>
                  <p className="text-gray-900">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Items</label>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">{item.menu_item_name}</p>
                        <p className="text-sm text-gray-600">₱{item.unit_price.toFixed(2)} each</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-900">Qty: {item.quantity}</p>
                        <p className="font-medium text-gray-900">₱{item.total_price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600">Receipt</label>
                  <button onClick={() => printReceipt(selectedOrder)} className="btn btn-outline btn-sm">Print Receipt</button>
                </div>
                <div className="border rounded p-4 bg-white max-w-xs">
                  <div className="text-center">
                    <p className="font-semibold text-sm">{shopInfo?.shop_name || 'Orijins Coffee House'}</p>
                    {shopInfo?.shop_address && (
                      <p className="text-xs text-gray-600">{shopInfo.shop_address}</p>
                    )}
                    {shopInfo?.shop_phone && (
                      <p className="text-xs text-gray-600">{shopInfo.shop_phone}</p>
                    )}
                  </div>
                  <div className="border-t border-dashed my-2"></div>
                  <div className="text-xs">
                    <div>INV#: <span className="font-medium">{selectedOrder.order_number}</span></div>
                    <div>
                      DATE: {new Date(selectedOrder.created_at).toLocaleDateString()} TIME: {new Date(selectedOrder.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="border-t border-dashed my-2"></div>
                  <div className="text-xs space-y-1">
                    {selectedOrder.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.quantity.toFixed(1)} x {it.menu_item_name}</span>
                        <span>{it.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dashed my-2"></div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>SUBTOTAL</span><span>{selectedOrder.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>TOTAL</span><span>{selectedOrder.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-dashed my-2"></div>
                    <div>PAYMENT RECEIVED: {formatMoney(selectedOrder.total_amount)}</div>
                    <div className="text-gray-600">{selectedOrder.payment_method.toUpperCase()}</div>
                    <div>CHANGE AMOUNT: {formatMoney(0)}</div>
                  </div>
                  <div className="border-t border-dashed my-2"></div>
                  <div className="text-center text-xs">Acknowledgement Receipt<br />Thank you!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Order Modal */}
      {showVoidModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Void Order</h3>
              <button
                onClick={() => setShowVoidModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Void Reason</label>
                <textarea
                  value={voidForm.void_reason}
                  onChange={(e) => setVoidForm({ ...voidForm, void_reason: e.target.value })}
                  placeholder="Enter reason for voiding this order..."
                  className="input"
                  rows={3}
                />
              </div>

              <div>
                <label className="label">Admin Username</label>
                <input
                  type="text"
                  value={voidForm.admin_username}
                  onChange={(e) => setVoidForm({ ...voidForm, admin_username: e.target.value })}
                  placeholder="Enter admin username"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Admin Password</label>
                <input
                  type="password"
                  value={voidForm.admin_password}
                  onChange={(e) => setVoidForm({ ...voidForm, admin_password: e.target.value })}
                  placeholder="Enter admin password"
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowVoidModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidOrder}
                className="btn btn-danger"
                disabled={!voidForm.void_reason || !voidForm.admin_username || !voidForm.admin_password}
              >
                Void Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
