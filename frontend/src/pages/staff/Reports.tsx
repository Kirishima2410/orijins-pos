import React, { useState, useEffect } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'orders' | 'items'>('sales');
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [ordersReport, setOrdersReport] = useState<OrdersReport | null>(null);
  const [topItemsReport, setTopItemsReport] = useState<TopItemsReport | null>(null);

  const [prevSalesReport, setPrevSalesReport] = useState<SalesReport | null>(null);
  const [prevOrdersReport, setPrevOrdersReport] = useState<OrdersReport | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);

      const daysDiff = differenceInDays(new Date(dateRange.to), new Date(dateRange.from)) + 1;
      const prevFrom = format(subDays(new Date(dateRange.from), daysDiff), 'yyyy-MM-dd');
      const prevTo = format(subDays(new Date(dateRange.to), daysDiff), 'yyyy-MM-dd');

      if (activeTab === 'sales') {
        const [currRes, prevRes] = await Promise.all([
          reportsAPI.getSales({ date_from: dateRange.from, date_to: dateRange.to, group_by: 'day' }),
          reportsAPI.getSales({ date_from: prevFrom, date_to: prevTo, group_by: 'day' })
        ]);
        setSalesReport(currRes.data);
        setPrevSalesReport(prevRes.data);
      } else if (activeTab === 'orders') {
        const [currRes, prevRes] = await Promise.all([
          reportsAPI.getOrders({ date_from: dateRange.from, date_to: dateRange.to }),
          reportsAPI.getOrders({ date_from: prevFrom, date_to: prevTo })
        ]);
        setOrdersReport(currRes.data);
        setPrevOrdersReport(prevRes.data);
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

  const handlePresetSelect = (preset: string) => {
    const today = new Date();
    let from, to;

    switch (preset) {
      case 'today':
        from = today;
        to = today;
        break;
      case 'yesterday':
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case 'last7':
        from = subDays(today, 6);
        to = today;
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = today;
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    setDateRange({
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd')
    });
  };

  const calculateGrowthCalc = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const GrowthBadge = ({ current, previous }: { current: number; previous: number }) => {
    const growth = calculateGrowthCalc(current, previous);
    const isPositive = growth > 0;
    const isNeutral = growth === 0 || isNaN(growth);

    if (isNeutral) {
      return <span className="text-[10px] font-medium text-gray-400 py-0 px-1.5 bg-gray-50 rounded-full border border-gray-100 flex items-center shrink-0">0% <span className="text-[9px] text-gray-400 font-normal ml-1">vs prev</span></span>;
    }

    return (
      <span className={`text-[10px] font-medium py-0 px-1.5 rounded-full border flex items-center shrink-0 whitespace-nowrap ${isPositive ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-700 bg-red-50 border-red-100'
        }`}>
        {isPositive ? (
          <ArrowTrendingUpIcon className="w-2.5 h-2.5 mr-0.5" />
        ) : (
          <ArrowTrendingUpIcon className="w-2.5 h-2.5 mr-0.5 rotate-180" />
        )}
        {Math.abs(growth).toFixed(0)}%
        <span className="text-[9px] text-gray-400 font-normal ml-0.5 opacity-80">vs prev</span>
      </span>
    );
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Reports - ${activeTab.toUpperCase()}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Date Range: ${dateRange.from} to ${dateRange.to}`, 14, 25);

      if (activeTab === 'sales' && salesReport) {
        doc.text('Sales by Category', 14, 35);
        autoTable(doc, {
          startY: 40,
          head: [['Category', 'Orders', 'Quantity', 'Revenue']],
          body: salesReport.sales_by_category.map((item: any) => [
            item.category_name,
            item.order_count,
            item.total_quantity,
            formatCurrency(item.revenue).replace('₱', 'PHP ')
          ]),
        });
      } else if (activeTab === 'orders' && ordersReport) {
        doc.text('Orders List', 14, 35);
        autoTable(doc, {
          startY: 40,
          head: [['Order #', 'Date', 'Customer', 'Amount', 'Method', 'Status']],
          body: ordersReport.order_list.map((order: any) => [
            order.order_number,
            formatChartDate(order.created_at, 'short'),
            order.customer_name || '-',
            formatCurrency(order.total_amount).replace('₱', 'PHP '),
            order.payment_method.toUpperCase(),
            order.status.toUpperCase()
          ]),
        });
      } else if (activeTab === 'items' && topItemsReport) {
        doc.text('Top Selling Items by Quantity', 14, 35);
        autoTable(doc, {
          startY: 40,
          head: [['Rank', 'Item Name', 'Category', 'Quantity', 'Revenue']],
          body: topItemsReport.top_by_quantity.map((item: any, index: number) => [
            String(index + 1),
            item.name,
            item.category_name,
            item.total_quantity,
            formatCurrency(item.total_revenue as any).replace('₱', 'PHP ')
          ]),
        });
      }
      doc.save(`orijins_report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('Report exported to PDF');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = () => {
    try {
      let data: any[] = [];
      let sheetName = '';

      if (activeTab === 'sales' && salesReport) {
        sheetName = 'Sales Report';
        data = salesReport.sales_by_category.map((item: any) => ({
          'Category': item.category_name,
          'Orders': item.order_count,
          'Quantity': item.total_quantity,
          'Revenue': item.revenue
        }));
      } else if (activeTab === 'orders' && ordersReport) {
        sheetName = 'Orders Report';
        data = ordersReport.order_list.map((order: any) => ({
          'Order Number': order.order_number,
          'Date': new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
          'Customer': order.customer_name || '-',
          'Amount': order.total_amount,
          'Payment Method': order.payment_method.toUpperCase(),
          'Status': order.status.toUpperCase()
        }));
      } else if (activeTab === 'items' && topItemsReport) {
        sheetName = 'Top Items';
        data = topItemsReport.top_by_quantity.map((item: any, index: number) => ({
          'Rank': index + 1,
          'Item Name': item.name,
          'Category': item.category_name,
          'Quantity Sold': item.total_quantity,
          'Revenue': item.total_revenue,
          'Avg Price': item.avg_price
        }));
      }

      if (data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();

      // Styling properties
      const headerStyle = {
        fill: { fgColor: { rgb: "4F81BD" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const cellStyle = {
        alignment: { horizontal: "left", vertical: "center" }
      };

      // Add currency text mapping specifically for excel to ensure it shows PHP peso explicitly
      // For headers, style them to be colored
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z100');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[address]) continue;
        ws[address].s = headerStyle; // Apply Header style
      }

      for (let R = 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[address]) continue;

          ws[address].s = cellStyle; // apply standard alignment
          // Explicitly append PHP if it resembles our financial columns but handle strings carefully
          if (ws[address].v !== undefined && typeof ws[address].v === 'number') {
            const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
            const colName = ws[headerCell] ? ws[headerCell].v : '';
            if (colName === 'Revenue' || colName === 'Amount' || colName === 'Avg Price') {
              ws[address].v = `₱${Number(ws[address].v).toFixed(2)}`;
              ws[address].t = 's'; // Treat as string so the ₱ doesn't break formatting
              ws[address].s = {
                alignment: { horizontal: "right", vertical: "center" }
              }
            }
          }
        }
      }

      // Automatically adjust column widths
      const colWidths = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = 10; // minimum width
        for (let R = 0; R <= range.e.r; ++R) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[address]) continue;
          const val = ws[address].v ? ws[address].v.toString() : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        }
        colWidths.push({ wch: maxLen + 2 }); // add some padding
      }
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');
      XLSX.writeFile(wb, `orijins_report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast.success('Report exported to Excel');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel');
    }
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
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 text-sm">
            <div className="flex items-center space-x-4">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handlePresetSelect('today')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">Today</button>
                <button onClick={() => handlePresetSelect('yesterday')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">Yesterday</button>
                <button onClick={() => handlePresetSelect('last7')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">Last 7 Days</button>
                <button onClick={() => handlePresetSelect('thisMonth')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">This Month</button>
                <button onClick={() => handlePresetSelect('lastMonth')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">Last Month</button>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <div>
                <label className="sr-only">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="input py-1 text-sm border-none bg-transparent"
                />
              </div>
              <span className="text-gray-400">→</span>
              <div>
                <label className="sr-only">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="input py-1 text-sm border-none bg-transparent"
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
                        <div className="flex items-center flex-wrap gap-x-2 mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {formatCurrency(salesReport.summary.total_revenue as any)}
                          </p>
                          {prevSalesReport && <GrowthBadge current={salesReport.summary.total_revenue} previous={prevSalesReport.summary.total_revenue} />}
                        </div>
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
                        <div className="flex items-center flex-wrap gap-x-2 mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {salesReport.summary.total_orders}
                          </p>
                          {prevSalesReport && <GrowthBadge current={salesReport.summary.total_orders} previous={prevSalesReport.summary.total_orders} />}
                        </div>
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
                        <div className="flex items-center flex-wrap gap-x-2 mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {formatCurrency(salesReport.summary.avg_order_value as any)}
                          </p>
                          {prevSalesReport && <GrowthBadge current={salesReport.summary.avg_order_value} previous={prevSalesReport.summary.avg_order_value} />}
                        </div>
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
                        <div className="flex items-center mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {formatCurrency(salesReport.summary.max_order_value as any)}
                          </p>
                        </div>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="category_name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-10} />
                      <Tooltip
                        formatter={(value) => [`₱${value}`, 'Revenue']}
                        cursor={{ fill: '#F3F4F6' }}
                        contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                      />
                      <Bar dataKey="revenue" name="Revenue" maxBarSize={60} radius={[4, 4, 0, 0]}>
                        {salesReport.sales_by_category.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
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
                        <div className="flex items-center flex-wrap gap-x-2 mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {ordersReport.summary.total_orders}
                          </p>
                          {prevOrdersReport && <GrowthBadge current={ordersReport.summary.total_orders} previous={prevOrdersReport.summary.total_orders} />}
                        </div>
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
                        <div className="flex items-center mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {ordersReport.summary.completed_orders}
                          </p>
                        </div>
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
                        <div className="flex items-center mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {ordersReport.summary.voided_orders}
                          </p>
                        </div>
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
                        <div className="flex items-center mt-1">
                          <p className="text-2xl font-semibold text-gray-900 leading-none">
                            {ordersReport.summary.avg_preparation_time || 0} min
                          </p>
                        </div>
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
                          nameKey="status"
                          label={({ status, percentage }) => `${(status || '').toString().toUpperCase()} (${percentage}%)`}
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
                      <BarChart data={[...ordersReport.orders_by_hour].map(item => {
                        const localHour = (item.hour + 8) % 24;
                        const ampm = localHour >= 12 ? 'PM' : 'AM';
                        const displayHour = localHour % 12 || 12;
                        return { ...item, localHour, display_hour: `${displayHour} ${ampm}` };
                      }).sort((a, b) => a.localHour - b.localHour)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="display_hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="order_count" name="Orders" fill="#8884d8" />
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
                      <Area type="monotone" dataKey="order_count" name="Total Orders" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="completed_count" name="Completed Orders" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Orders List */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Orders List</h3>
                </div>
                <div className="card-body">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-header-cell">Order Number</th>
                          <th className="table-header-cell">Date</th>
                          <th className="table-header-cell">Customer</th>
                          <th className="table-header-cell">Amount</th>
                          <th className="table-header-cell">Payment Method</th>
                          <th className="table-header-cell">Status</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {ordersReport.order_list.map((order) => (
                          <tr key={order.id} className="table-row">
                            <td className="table-cell font-medium">{order.order_number}</td>
                            <td className="table-cell">{new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                            <td className="table-cell">{order.customer_name || '-'}</td>
                            <td className="table-cell font-medium">{formatCurrency(order.total_amount)}</td>
                            <td className="table-cell uppercase">{order.payment_method}</td>
                            <td className="table-cell">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${order.status === 'completed' ? 'bg-success-100 text-success-800' :
                                  order.status === 'voided' ? 'bg-danger-100 text-danger-800' :
                                    'bg-warning-100 text-warning-800'}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
