import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { reportsAPI } from '../../utils/api';
import { SalesReport, OrdersReport, TopItemsReport } from '../../types';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'orders' | 'items'>('sales');
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [ordersReport, setOrdersReport] = useState<OrdersReport | null>(null);
  const [topItemsReport, setTopItemsReport] = useState<TopItemsReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, [dateRange, activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);

      if (activeTab === 'sales') {
        const response = await reportsAPI.getSales({
          date_from: dateRange.from,
          date_to: dateRange.to,
          group_by: 'day',
        });
        setSalesReport(response.data);
      } else if (activeTab === 'orders') {
        const response = await reportsAPI.getOrders({
          date_from: dateRange.from,
          date_to: dateRange.to,
        });
        setOrdersReport(response.data);
      } else if (activeTab === 'items') {
        const response = await reportsAPI.getTopItems({
          date_from: dateRange.from,
          date_to: dateRange.to,
          limit: 10,
        });
        setTopItemsReport(response.data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => `₱${Number(value || 0).toFixed(2)}`;

  const formatChartDate = (dateString: string, formatStyle: 'short' | 'long' = 'short') => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: formatStyle === 'short' ? 'short' : 'long',
        day: 'numeric',
        year: formatStyle === 'long' ? 'numeric' : undefined
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  const handleExportPDF = () => {
    toast.success('PDF export feature coming soon');
  };

  const handleExportExcel = () => {
    toast.success('Excel export feature coming soon');
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const tabs = [
    { id: 'sales', name: 'Sales Report', icon: CurrencyDollarIcon },
    { id: 'orders', name: 'Orders Report', icon: ShoppingCartIcon },
    { id: 'items', name: 'Top Items', icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-2 text-gray-600">
            View sales reports, analytics, and business insights
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportPDF}
            className="btn btn-outline"
          >
            <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="btn btn-outline"
          >
            <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            <div className="flex items-center space-x-3">
              <div>
                <label className="label">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          {/* Sales Report */}
          {activeTab === 'sales' && salesReport && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-success-500">
                        <CurrencyDollarIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesReport.summary.total_revenue as any)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-primary-500">
                        <ShoppingCartIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Orders</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {salesReport.summary.total_orders}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-warning-500">
                        <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Average Order Value</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesReport.summary.avg_order_value as any)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-info-500">
                        <ChartBarIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Max Order Value</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesReport.summary.max_order_value as any)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Sales Trend</h3>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={salesReport.sales_by_date}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="period"
                          tickFormatter={(value) => formatChartDate(value, 'short')}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(value) => formatChartDate(value, 'long')}
                          formatter={(value) => [`₱${value}`, 'Revenue']}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Payment Method Distribution */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Payment Method Distribution</h3>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salesReport.sales_by_payment}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ payload }) => `${(payload?.payment_method || payload?.name || '').toString().toUpperCase()} (${payload?.percentage}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="revenue"
                        >
                          {salesReport.sales_by_payment.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`₱${value}`, 'Revenue']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Sales by Category */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Sales by Category</h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesReport.sales_by_category}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category_name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`₱${value}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Orders Report */}
          {activeTab === 'orders' && ordersReport && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-primary-500">
                        <ShoppingCartIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Orders</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {ordersReport.summary.total_orders}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-success-500">
                        <CheckCircleIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Completed</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {ordersReport.summary.completed_orders}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-danger-500">
                        <XMarkIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Voided</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {ordersReport.summary.voided_orders}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-3 rounded-lg bg-warning-500">
                        <ClockIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Avg Prep Time</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {ordersReport.summary.avg_preparation_time || 0} min
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Orders by Status */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Orders by Status</h3>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={ordersReport.orders_by_status}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name} (${percentage}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {ordersReport.orders_by_status.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Orders by Hour */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Orders by Hour (Peak Hours)</h3>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ordersReport.orders_by_hour}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="order_count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Daily Orders Trend */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Daily Orders Trend</h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={ordersReport.daily_orders}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => formatChartDate(value, 'short')}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => formatChartDate(value, 'long')}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="order_count" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="completed_count" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Top Items Report */}
          {activeTab === 'items' && topItemsReport && (
            <div className="space-y-6">
              {/* Top Items by Quantity */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Top Selling Items by Quantity</h3>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-header-cell">Rank</th>
                          <th className="table-header-cell">Item Name</th>
                          <th className="table-header-cell">Category</th>
                          <th className="table-header-cell">Quantity Sold</th>
                          <th className="table-header-cell">Revenue</th>
                          <th className="table-header-cell">Avg Price</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {topItemsReport.top_by_quantity.map((item, index) => (
                          <tr key={item.id} className="table-row">
                            <td className="table-cell">
                              <span className="flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-600 rounded-full font-medium">
                                {index + 1}
                              </span>
                            </td>
                            <td className="table-cell font-medium">{item.name}</td>
                            <td className="table-cell">{item.category_name}</td>
                            <td className="table-cell">{item.total_quantity}</td>
                            <td className="table-cell font-medium">{formatCurrency(item.total_revenue as any)}</td>
                            <td className="table-cell">{formatCurrency(item.avg_price as any)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Top Items by Revenue */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Top Selling Items by Revenue</h3>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-header-cell">Rank</th>
                          <th className="table-header-cell">Item Name</th>
                          <th className="table-header-cell">Category</th>
                          <th className="table-header-cell">Quantity Sold</th>
                          <th className="table-header-cell">Revenue</th>
                          <th className="table-header-cell">Avg Price</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {topItemsReport.top_by_revenue.map((item, index) => (
                          <tr key={item.id} className="table-row">
                            <td className="table-cell">
                              <span className="flex items-center justify-center w-8 h-8 bg-success-100 text-success-600 rounded-full font-medium">
                                {index + 1}
                              </span>
                            </td>
                            <td className="table-cell font-medium">{item.name}</td>
                            <td className="table-cell">{item.category_name}</td>
                            <td className="table-cell">{item.total_quantity}</td>
                            <td className="table-cell font-medium">{formatCurrency(item.total_revenue as any)}</td>
                            <td className="table-cell">{formatCurrency(item.avg_price as any)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Unsold Items */}
              {topItemsReport.unsold_items.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Items That Didn't Sell</h3>
                  </div>
                  <div className="card-body">
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="table-header">
                          <tr>
                            <th className="table-header-cell">Item Name</th>
                            <th className="table-header-cell">Category</th>
                            <th className="table-header-cell">Price</th>
                          </tr>
                        </thead>
                        <tbody className="table-body">
                          {topItemsReport.unsold_items.map((item) => (
                            <tr key={item.id} className="table-row">
                              <td className="table-cell font-medium">{item.name}</td>
                              <td className="table-cell">{item.category_name}</td>
                              <td className="table-cell">{formatCurrency(item.price as any)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
