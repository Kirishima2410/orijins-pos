import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../utils/api';
import { DashboardOverview } from '../../types';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const StaffDashboard: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      setOverview(response.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load dashboard data</p>
        <button onClick={loadDashboardData} className="btn btn-primary mt-4">
          Try Again
        </button>
      </div>
    );
  }

  const stats = [
    {
      name: "Today's Sales",
      value: `₱${overview.today_sales.total_revenue.toFixed(2)}`,
      change: null,
      changeType: null,
      icon: CurrencyDollarIcon,
      color: 'bg-success-500',
    },
    {
      name: "Total Orders for Today",
      value: overview.today_sales.total_orders.toString(),
      change: null,
      changeType: null,
      icon: ShoppingCartIcon,
      color: 'bg-primary-500',
    },
    {
      name: "Pending Orders",
      value: overview.pending_orders.toString(),
      change: null,
      changeType: null,
      icon: ClockIcon,
      color: 'bg-warning-500',
    },
    {
      name: "Low Stock Alerts",
      value: overview.low_stock_alerts.toString(),
      change: null,
      changeType: null,
      icon: ExclamationTriangleIcon,
      color: 'bg-danger-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's what's happening at your coffee shop today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card h-full">
            <div className="card-body h-full">
              <div className="flex items-center gap-4 h-full">
                <div className={`flex-shrink-0 p-3 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">{stat.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    {stat.change && (
                      <div className="flex items-center text-sm">
                        {stat.changeType === 'increase' ? (
                          <ArrowTrendingUpIcon className="w-4 h-4 text-success-500" />
                        ) : (
                          <ArrowTrendingDownIcon className="w-4 h-4 text-danger-500" />
                        )}
                        <span
                          className={`${stat.changeType === 'increase' ? 'text-success-600' : 'text-danger-600'} ml-1`}
                        >
                          {stat.change}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
              <Link
                to="/staff/orders"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="card-body">
            {overview.recent_orders.length > 0 ? (
              <div className="space-y-4">
                {overview.recent_orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-sm text-gray-600">
                        {order.item_count} item{order.item_count !== 1 ? 's' : ''} • {order.payment_method}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">₱{order.total_amount.toFixed(2)}</p>
                      <span
                        className={`badge ${order.status === 'completed'
                          ? 'badge-success'
                          : order.status === 'pending'
                            ? 'badge-warning'
                            : 'badge-info'
                          }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No recent orders</p>
            )}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Top Selling Items Today</h2>
          </div>
          <div className="card-body">
            {overview.top_items.length > 0 ? (
              <div className="space-y-4">
                {overview.top_items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-primary-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.category_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.total_quantity} sold</p>
                      <p className="text-sm text-gray-600">₱{item.total_revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No sales data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Payment Method Breakdown (Today)</h2>
        </div>
        <div className="card-body">
          {overview.payment_breakdown.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {overview.payment_breakdown.map((payment) => (
                <div key={payment.payment_method} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full mr-3 ${payment.payment_method === 'cash' ? 'bg-green-500' : 'bg-blue-500'
                      }`}></div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{payment.payment_method}</p>
                      <p className="text-sm text-gray-600">{payment.count} orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₱{payment.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">
                      {((payment.amount / overview.today_sales.total_revenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No payment data available</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/staff/pos"
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="text-center">
                <ShoppingCartIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">New Order</p>
              </div>
            </Link>
            <Link
              to="/staff/orders"
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="text-center">
                <ClockIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Manage Orders</p>
              </div>
            </Link>
            <Link
              to="/staff/menu"
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="text-center">
                <ExclamationTriangleIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Update Menu</p>
              </div>
            </Link>
            <Link
              to="/staff/inventory"
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="text-center">
                <ArchiveBoxIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Manage Inventory</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
