const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get sales report
router.get('/sales', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { date_from, date_to, group_by = 'day' } = req.query;

        if (!date_from || !date_to) {
            return res.status(400).json({ error: 'Date range is required' });
        }

        let dateFormat;
        switch (group_by) {
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00';
                break;
            case 'day':
                dateFormat = '%Y-%m-%d';
                break;
            case 'week':
                dateFormat = '%Y-%u';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                break;
            default:
                dateFormat = '%Y-%m-%d';
        }

        // Sales summary
        const [summary] = await pool.execute(
            `SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value,
                MIN(total_amount) as min_order_value,
                MAX(total_amount) as max_order_value
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ? AND is_voided = FALSE AND status = 'completed'`,
            [date_from, date_to]
        );

        // Sales by date
        const [salesByDate] = await pool.execute(
            `SELECT 
                DATE_FORMAT(created_at, '${dateFormat}') as period,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ? AND is_voided = FALSE AND status = 'completed'
             GROUP BY DATE_FORMAT(created_at, '${dateFormat}')
             ORDER BY period`,
            [date_from, date_to]
        );

        // Sales by payment method
        const [salesByPayment] = await pool.execute(
            `SELECT 
                payment_method,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND is_voided = FALSE AND status = 'completed'), 2) as percentage
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ? AND is_voided = FALSE AND status = 'completed'
             GROUP BY payment_method`,
            [date_from, date_to, date_from, date_to]
        );

        // Sales by category
        const [salesByCategory] = await pool.execute(
            `SELECT 
                c.name as category_name,
                COUNT(DISTINCT o.id) as order_count,
                SUM(oi.quantity) as total_quantity,
                COALESCE(SUM(oi.total_price), 0) as revenue
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.is_voided = FALSE AND o.status = 'completed'
             GROUP BY c.id, c.name
             ORDER BY revenue DESC`,
            [date_from, date_to]
        );

        res.json({
            summary: summary[0],
            sales_by_date: salesByDate,
            sales_by_payment: salesByPayment,
            sales_by_category: salesByCategory,
            date_range: { from: date_from, to: date_to },
            group_by
        });
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get orders report
router.get('/orders', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { date_from, date_to } = req.query;

        if (!date_from || !date_to) {
            return res.status(400).json({ error: 'Date range is required' });
        }

        // Orders summary
        const [summary] = await pool.execute(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_orders,
                COUNT(CASE WHEN status IN ('pending', 'in_progress', 'ready') THEN 1 END) as active_orders,
                ROUND(AVG(CASE WHEN status = 'completed' THEN TIMESTAMPDIFF(MINUTE, created_at, updated_at) END), 2) as avg_preparation_time
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ?`,
            [date_from, date_to]
        );

        // Orders by status
        const [ordersByStatus] = await pool.execute(
            `SELECT 
                status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE DATE(created_at) BETWEEN ? AND ?), 2) as percentage
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ?
             GROUP BY status`,
            [date_from, date_to, date_from, date_to]
        );

        // Orders by hour (peak hours analysis)
        const [ordersByHour] = await pool.execute(
            `SELECT 
                HOUR(created_at) as hour,
                COUNT(*) as order_count
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ?
             GROUP BY HOUR(created_at)
             ORDER BY hour`,
            [date_from, date_to]
        );

        // Daily orders trend
        const [dailyOrders] = await pool.execute(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as order_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count
             FROM orders 
             WHERE DATE(created_at) BETWEEN ? AND ?
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [date_from, date_to]
        );

        res.json({
            summary: summary[0],
            orders_by_status: ordersByStatus,
            orders_by_hour: ordersByHour,
            daily_orders: dailyOrders,
            date_range: { from: date_from, to: date_to }
        });
    } catch (error) {
        console.error('Orders report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get top selling items report
router.get('/top-items', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { date_from, date_to, limit = 10 } = req.query;

        if (!date_from || !date_to) {
            return res.status(400).json({ error: 'Date range is required' });
        }

        // Top selling items by quantity
        const [topByQuantity] = await pool.execute(
            `SELECT 
                mi.id,
                mi.name,
                c.name as category_name,
                SUM(oi.quantity) as total_quantity,
                COALESCE(SUM(oi.total_price), 0) as total_revenue,
                ROUND(AVG(oi.unit_price), 2) as avg_price,
                COUNT(DISTINCT o.id) as order_count
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.is_voided = FALSE AND o.status = 'completed'
             GROUP BY mi.id, mi.name, c.name
             ORDER BY total_quantity DESC
             LIMIT ${parseInt(limit)}`,
            [date_from, date_to]
        );

        // Top selling items by revenue
        const [topByRevenue] = await pool.execute(
            `SELECT 
                mi.id,
                mi.name,
                c.name as category_name,
                SUM(oi.quantity) as total_quantity,
                COALESCE(SUM(oi.total_price), 0) as total_revenue,
                ROUND(AVG(oi.unit_price), 2) as avg_price,
                COUNT(DISTINCT o.id) as order_count
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.is_voided = FALSE AND o.status = 'completed'
             GROUP BY mi.id, mi.name, c.name
             ORDER BY total_revenue DESC
             LIMIT ${parseInt(limit)}`,
            [date_from, date_to]
        );

        // Items that didn't sell (if any)
        const [unsoldItems] = await pool.execute(
            `SELECT 
                mi.id,
                mi.name,
                c.name as category_name,
                mi.price
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE mi.is_available = TRUE
             AND mi.id NOT IN (
                 SELECT DISTINCT oi.menu_item_id
                 FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.is_voided = FALSE AND o.status = 'completed'
             )
             ORDER BY mi.name`,
            [date_from, date_to]
        );

        res.json({
            top_by_quantity: topByQuantity,
            top_by_revenue: topByRevenue,
            unsold_items: unsoldItems,
            date_range: { from: date_from, to: date_to },
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Top items report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Inventory report logic removed
// router.get('/inventory', ...)

// Get audit logs report
router.get('/audit-logs', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { date_from, date_to, user_id, action, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT 
                al.*,
                u.username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (date_from && date_to) {
            query += ' AND DATE(al.created_at) BETWEEN ? AND ?';
            params.push(date_from, date_to);
        }

        if (user_id) {
            query += ' AND al.user_id = ?';
            params.push(user_id);
        }

        if (action) {
            query += ' AND al.action = ?';
            params.push(action);
        }

        query += ' ORDER BY al.created_at DESC';

        // Add pagination
        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [auditLogs] = await pool.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1';
        const countParams = [];

        if (date_from && date_to) {
            countQuery += ' AND DATE(al.created_at) BETWEEN ? AND ?';
            countParams.push(date_from, date_to);
        }

        if (user_id) {
            countQuery += ' AND al.user_id = ?';
            countParams.push(user_id);
        }

        if (action) {
            countQuery += ' AND al.action = ?';
            countParams.push(action);
        }

        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            audit_logs: auditLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Audit logs report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
