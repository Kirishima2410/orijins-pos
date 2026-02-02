const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole, isAdminOrOwner } = require('../config/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Test database connection (no auth required)
router.get('/test', async (req, res) => {
    try {
        console.log('Testing database connection...');
        const [result] = await pool.execute('SELECT 1 as test');
        console.log('Database test result:', result);
        res.json({ success: true, message: 'Database connected', result });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
});

// Generate order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `ORD-${timestamp}-${random}`;
};

// Create new order (customer or staff)
router.post('/', [
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.menu_item_id').custom((v) => Number.isInteger(Number(v))).withMessage('Invalid menu item ID'),
    body('items.*.quantity').custom((v) => Number.isInteger(Number(v)) && Number(v) >= 1).withMessage('Quantity must be at least 1'),
    body('payment_method').isIn(['cash', 'gcash']).withMessage('Invalid payment method'),
    body('customer_name').optional({ nullable: true }).isString().withMessage('Customer name must be a string')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { items, payment_method, customer_name } = req.body;
        const normalizedItems = items.map((i) => ({
            menu_item_id: Number(i.menu_item_id),
            menu_item_variant_id: i.menu_item_variant_id ? Number(i.menu_item_variant_id) : null,
            quantity: Number(i.quantity)
        }));
        const orderNumber = generateOrderNumber();

        // Validate menu items and calculate total
        let totalAmount = 0;
        const validatedItems = [];

        for (const item of normalizedItems) {
            const [menuItems] = await connection.execute(
                'SELECT id, name, price, is_available, stock_quantity FROM menu_items WHERE id = ?',
                [item.menu_item_id]
            );

            if (menuItems.length === 0) {
                throw new Error(`Menu item with ID ${item.menu_item_id} not found`);
            }

            const menuItem = menuItems[0];

            if (!menuItem.is_available) {
                throw new Error(`Menu item "${menuItem.name}" is not available`);
            }

            if (menuItem.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for "${menuItem.name}". Available: ${menuItem.stock_quantity}`);
            }

            // Determine price from variant if provided
            let unitPrice = menuItem.price;
            let variantName = null;
            let sizeLabel = null;
            let variantId = item.menu_item_variant_id;
            if (item.menu_item_variant_id) {
                const [variants] = await connection.execute(
                    'SELECT id, variant_name, size_label, price, is_available FROM menu_item_variants WHERE id = ? AND menu_item_id = ?',
                    [item.menu_item_variant_id, item.menu_item_id]
                );
                if (variants.length === 0) {
                    throw new Error(`Variant not found for item ${menuItem.name}`);
                }
                const v = variants[0];
                if (!v.is_available) {
                    throw new Error(`Selected variant is not available for "${menuItem.name}"`);
                }
                unitPrice = v.price;
                variantName = v.variant_name;
                sizeLabel = v.size_label;
                variantId = v.id;
            }

            const itemTotal = unitPrice * item.quantity;
            totalAmount += itemTotal;

            validatedItems.push({
                ...item,
                menu_item_variant_id: variantId,
                variant_name: variantName,
                size_label: sizeLabel,
                unit_price: unitPrice,
                total_price: itemTotal,
                menu_item_name: menuItem.name
            });
        }

        // Create order
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (order_number, customer_name, total_amount, payment_method) VALUES (?, ?, ?, ?)',
            [orderNumber, customer_name || null, totalAmount, payment_method]
        );

        const orderId = orderResult.insertId;

        // Create order items and update stock
        for (const item of validatedItems) {
            // Insert order item
            await connection.execute(
                'INSERT INTO order_items (order_id, menu_item_id, menu_item_variant_id, variant_name, size_label, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [orderId, item.menu_item_id, item.menu_item_variant_id, item.variant_name, item.size_label, item.quantity, item.unit_price, item.total_price]
            );

            // Update stock quantity
            await connection.execute(
                'UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [item.quantity, item.menu_item_id]
            );

            // Log inventory change
            const [currentStock] = await connection.execute(
                'SELECT stock_quantity FROM menu_items WHERE id = ?',
                [item.menu_item_id]
            );

            await connection.execute(
                'INSERT INTO inventory_logs (menu_item_id, action_type, quantity_change, previous_stock, new_stock, reference_order_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    item.menu_item_id,
                    'sale',
                    -item.quantity,
                    currentStock[0].stock_quantity + item.quantity,
                    currentStock[0].stock_quantity,
                    orderId,
                    `Sold in order ${orderNumber}`
                ]
            );
        }

        // Create transaction record
        await connection.execute(
            'INSERT INTO transactions (order_id, amount, payment_method) VALUES (?, ?, ?)',
            [orderId, totalAmount, payment_method]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Order created successfully',
            order: {
                id: orderId,
                order_number: orderNumber,
                total_amount: totalAmount,
                payment_method,
                items: validatedItems
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create order error:', error);
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Get all orders (staff only)
router.get('/', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        let { status, payment_method, search } = req.query;
        // Normalize values for consistent filtering
        status = typeof status === 'string' ? status.trim().toLowerCase() : '';
        payment_method = typeof payment_method === 'string' ? payment_method.trim().toLowerCase() : '';
        search = typeof search === 'string' ? search.trim() : '';

        // Build dynamic filters
        const whereClauses = [];
        const params = [];

        if (status) {
            if (status === 'voided') {
                // Some datasets use a boolean and/or a status string
                whereClauses.push('(is_voided = TRUE OR status = "voided")');
            } else {
                whereClauses.push('status = ?');
                params.push(status);
            }
        }

        if (payment_method) {
            whereClauses.push('LOWER(payment_method) = ?');
            params.push(payment_method);
        }

        if (search) {
            whereClauses.push('(order_number LIKE ? OR customer_name LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like);
        }

        const { startDate, endDate } = req.query;
        if (startDate) {
            whereClauses.push('DATE(created_at) >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push('DATE(created_at) <= ?');
            params.push(endDate);
        }

        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const listSQL = `SELECT * FROM orders ${whereSQL} ORDER BY created_at DESC LIMIT 100`;
        const [orders] = await pool.execute(listSQL, params);

        // Add item_count to each order
        for (const order of orders) {
            const [countRows] = await pool.execute(
                'SELECT COUNT(*) as count FROM order_items WHERE order_id = ?',
                [order.id]
            );
            order.item_count = countRows[0].count;
        }

        // Get total count for pagination
        const [countTotal] = await pool.execute(`SELECT COUNT(*) as total FROM orders ${whereSQL}`, params);
        const total = countTotal[0].total;

        res.json({
            orders,
            pagination: {
                page: 1,
                limit: 100,
                total,
                pages: Math.ceil(total / 100)
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single order with items
router.get('/:id', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Get order details
        const [orders] = await pool.execute(
            'SELECT * FROM orders WHERE id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get order items
        const [items] = await pool.execute(
            `SELECT oi.*, mi.name as menu_item_name, mi.description as menu_item_description
             FROM order_items oi
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE oi.order_id = ?
             ORDER BY oi.id`,
            [id]
        );

        const order = orders[0];
        order.items = items;

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status
router.patch('/:id/status', [
    authenticateToken,
    requireRole(['owner', 'admin', 'cashier']),
    body('status').isIn(['pending', 'in_progress', 'ready', 'completed']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { status } = req.body;

        // Get current order
        const [orders] = await pool.execute(
            'SELECT * FROM orders WHERE id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Check if order is already voided
        if (order.is_voided) {
            return res.status(400).json({ error: 'Cannot update status of voided order' });
        }

        await pool.execute(
            'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                'status_update',
                'orders',
                id,
                JSON.stringify({ status: order.status }),
                JSON.stringify({ status })
            ]
        );

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Void order (requires admin verification)
router.post('/:id/void', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('void_reason').notEmpty().withMessage('Void reason is required'),
    body('admin_username').notEmpty().withMessage('Admin username is required'),
    body('admin_password').notEmpty().withMessage('Admin password is required')
], async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { void_reason, admin_username, admin_password } = req.body;

        // Verify admin credentials
        const [admins] = await connection.execute(
            'SELECT id, username, password_hash, role FROM users WHERE username = ? AND role IN ("owner", "admin") AND is_active = TRUE',
            [admin_username]
        );

        if (admins.length === 0) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const admin = admins[0];
        const { comparePassword } = require('../config/auth');
        const isPasswordValid = await comparePassword(admin_password, admin.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Get order with items
        const [orders] = await connection.execute(
            'SELECT * FROM orders WHERE id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        if (order.is_voided) {
            return res.status(400).json({ error: 'Order is already voided' });
        }

        // Get order items for stock restoration
        const [orderItems] = await connection.execute(
            'SELECT * FROM order_items WHERE order_id = ?',
            [id]
        );

        // Restore stock quantities
        for (const item of orderItems) {
            await connection.execute(
                'UPDATE menu_items SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [item.quantity, item.menu_item_id]
            );

            // Log inventory restoration
            const [currentStock] = await connection.execute(
                'SELECT stock_quantity FROM menu_items WHERE id = ?',
                [item.menu_item_id]
            );

            await connection.execute(
                'INSERT INTO inventory_logs (menu_item_id, action_type, quantity_change, previous_stock, new_stock, reference_order_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    item.menu_item_id,
                    'adjustment',
                    item.quantity,
                    currentStock[0].stock_quantity - item.quantity,
                    currentStock[0].stock_quantity,
                    id,
                    `Stock restored from voided order ${order.order_number}`
                ]
            );
        }

        // Void the order
        await connection.execute(
            'UPDATE orders SET is_voided = TRUE, void_reason = ?, voided_by = ?, voided_at = CURRENT_TIMESTAMP, status = "voided", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [void_reason, admin.id, id]
        );

        await connection.commit();

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [
                req.user.id,
                'void_order',
                'orders',
                id,
                JSON.stringify({ void_reason, voided_by: admin.id })
            ]
        );

        res.json({ message: 'Order voided successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Void order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Get today's orders summary
router.get('/stats/today', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Get orders count by status
        const [statusCounts] = await pool.execute(
            `SELECT status, COUNT(*) as count 
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE
             GROUP BY status`,
            [today]
        );

        // Get total sales
        const [salesResult] = await pool.execute(
            `SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_sales,
                COALESCE(AVG(total_amount), 0) as avg_order_value
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'`,
            [today]
        );

        // Get payment method breakdown
        const [paymentBreakdown] = await pool.execute(
            `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
             FROM orders 
             WHERE DATE(created_at) = ? AND is_voided = FALSE AND status = 'completed'
             GROUP BY payment_method`,
            [today]
        );

        res.json({
            date: today,
            status_counts: statusCounts,
            sales: salesResult[0],
            payment_breakdown: paymentBreakdown
        });
    } catch (error) {
        console.error('Get today stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
