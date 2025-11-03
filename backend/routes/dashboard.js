const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get dashboard overview data
router.get('/overview', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Today's sales
        const [todaySales] = await pool.execute(
            `SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'`,
            [today]
        );

        // Pending orders count
        const [pendingOrders] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM orders 
             WHERE status IN ('pending', 'in_progress', 'ready') AND is_voided = FALSE`
        );

        // Low stock alerts
        const [lowStock] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM menu_items 
             WHERE stock_quantity <= low_stock_threshold AND is_available = TRUE`
        );

        // Recent orders (last 10) - avoid ONLY_FULL_GROUP_BY by using scalar subquery
        const [recentOrders] = await pool.execute(
            `SELECT 
                o.id, o.order_number, o.total_amount, o.status, o.payment_method, o.created_at,
                (
                    SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id
                ) AS item_count
             FROM orders o
             WHERE o.is_voided = FALSE
             ORDER BY o.created_at DESC
             LIMIT 10`
        );

        // Sales by payment method (today)
        const [paymentBreakdown] = await pool.execute(
            `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'
             GROUP BY payment_method`,
            [today]
        );

        // Top selling items (today)
        const [topItems] = await pool.execute(
            `SELECT mi.name, mi.category_id, c.name as category_name,
                    SUM(oi.quantity) as total_quantity,
                    SUM(oi.total_price) as total_revenue
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE DATE(o.created_at) = ? AND o.is_voided = FALSE AND o.status = 'completed'
             GROUP BY mi.id, mi.name, mi.category_id, c.name
             ORDER BY total_quantity DESC
             LIMIT 5`,
            [today]
        );

        res.json({
            today_sales: todaySales?.[0] || { total_orders: 0, total_revenue: 0, avg_order_value: 0 },
            pending_orders: pendingOrders?.[0]?.count || 0,
            low_stock_alerts: lowStock?.[0]?.count || 0,
            recent_orders: recentOrders || [],
            payment_breakdown: paymentBreakdown || [],
            top_items: topItems || []
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.json({
            today_sales: { total_orders: 0, total_revenue: 0, avg_order_value: 0 },
            pending_orders: 0,
            low_stock_alerts: 0,
            recent_orders: [],
            payment_breakdown: [],
            top_items: []
        });
    }
});

// Get sales chart data
router.get('/sales-chart', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const { period = 'week' } = req.query;
        let dateFormat, dateCondition;

        switch (period) {
            case 'day':
                dateFormat = '%Y-%m-%d %H:00';
                dateCondition = 'DATE(created_at) = CURDATE()';
                break;
            case 'week':
                dateFormat = '%Y-%m-%d';
                dateCondition = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                break;
            case 'month':
                dateFormat = '%Y-%m-%d';
                dateCondition = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
                break;
            case 'year':
                dateFormat = '%Y-%m';
                dateCondition = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
                break;
            default:
                dateFormat = '%Y-%m-%d';
                dateCondition = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        }

        const [salesData] = await pool.execute(
            `SELECT 
                DATE_FORMAT(created_at, '${dateFormat}') as date,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
             FROM orders 
             WHERE ${dateCondition} AND is_voided = FALSE AND status = 'completed'
             GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
             ORDER BY date`
        );

        res.json({
            period,
            data: salesData
        });
    } catch (error) {
        console.error('Sales chart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get inventory status
router.get('/inventory', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        // Low stock items
        const [lowStockItems] = await pool.execute(
            `SELECT mi.id, mi.name, mi.stock_quantity, mi.low_stock_threshold, c.name as category_name
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE mi.stock_quantity <= mi.low_stock_threshold AND mi.is_available = TRUE
             ORDER BY (mi.stock_quantity / mi.low_stock_threshold) ASC`
        );

        // Out of stock items
        const [outOfStockItems] = await pool.execute(
            `SELECT mi.id, mi.name, c.name as category_name
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE mi.stock_quantity = 0 AND mi.is_available = TRUE
             ORDER BY mi.name`
        );

        // Inventory summary
        const [inventorySummary] = await pool.execute(
            `SELECT 
                COUNT(*) as total_items,
                COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock,
                COUNT(CASE WHEN stock_quantity <= low_stock_threshold AND stock_quantity > 0 THEN 1 END) as low_stock,
                COUNT(CASE WHEN stock_quantity > low_stock_threshold THEN 1 END) as in_stock
             FROM menu_items 
             WHERE is_available = TRUE`
        );

        res.json({
            summary: inventorySummary[0],
            low_stock: lowStockItems,
            out_of_stock: outOfStockItems
        });
    } catch (error) {
        console.error('Inventory status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recent activity
router.get('/activity', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        // Recent orders
        const [recentOrders] = await pool.execute(
            `SELECT o.id, o.order_number, o.total_amount, o.status, o.payment_method, o.created_at
             FROM orders o
             WHERE o.is_voided = FALSE
             ORDER BY o.created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        // Recent transactions (completed orders)
        const [recentTransactions] = await pool.execute(
            `SELECT o.id, o.order_number, o.total_amount, o.payment_method, o.created_at
             FROM orders o
             WHERE o.status = 'completed' AND o.is_voided = FALSE
             ORDER BY o.created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        // System notifications (low stock, etc.)
        const [notifications] = await pool.execute(
            `SELECT 
                'low_stock' as type,
                CONCAT('Low stock alert: ', mi.name, ' (', mi.stock_quantity, ' remaining)') as message,
                mi.updated_at as created_at
             FROM menu_items mi
             WHERE mi.stock_quantity <= mi.low_stock_threshold AND mi.is_available = TRUE
             ORDER BY mi.updated_at DESC
             LIMIT 10`
        );

        res.json({
            recent_orders: recentOrders,
            recent_transactions: recentTransactions,
            notifications
        });
    } catch (error) {
        console.error('Activity feed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get quick stats for today
router.get('/quick-stats', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Today's stats
        const [todayStats] = await pool.execute(
            `SELECT 
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'`,
            [today]
        );

        // Yesterday's stats for comparison
        const [yesterdayStats] = await pool.execute(
            `SELECT 
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'`,
            [yesterday]
        );

        // Calculate percentage changes
        const ordersChange = yesterdayStats[0].orders > 0 
            ? ((todayStats[0].orders - yesterdayStats[0].orders) / yesterdayStats[0].orders * 100)
            : 0;
        
        const revenueChange = yesterdayStats[0].revenue > 0 
            ? ((todayStats[0].revenue - yesterdayStats[0].revenue) / yesterdayStats[0].revenue * 100)
            : 0;

        const avgOrderChange = yesterdayStats[0].avg_order_value > 0 
            ? ((todayStats[0].avg_order_value - yesterdayStats[0].avg_order_value) / yesterdayStats[0].avg_order_value * 100)
            : 0;

        res.json({
            today: todayStats[0],
            yesterday: yesterdayStats[0],
            changes: {
                orders: parseFloat(ordersChange.toFixed(1)),
                revenue: parseFloat(revenueChange.toFixed(1)),
                avg_order_value: parseFloat(avgOrderChange.toFixed(1))
            }
        });
    } catch (error) {
        console.error('Quick stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
