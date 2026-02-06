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
    body('customer_name').optional({ nullable: true }).isString().withMessage('Customer name must be a string'),
    body('table_number').optional({ nullable: true }).isString().withMessage('Table number must be a string'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'ready']).withMessage('Invalid status'),
    body('discount_amount').optional().isFloat({ min: 0 }),
    body('cash_received').optional().isFloat({ min: 0 }),
    body('change_amount').optional().isFloat({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { items, payment_method, customer_name, table_number } = req.body;
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

        // Apply discount if provided
        let finalTotalAmount = totalAmount;
        const discountAmount = req.body.discount_amount ? Number(req.body.discount_amount) : 0.00;
        const cashReceived = req.body.cash_received ? Number(req.body.cash_received) : 0.00;
        const changeAmount = req.body.change_amount ? Number(req.body.change_amount) : 0.00;
        const status = req.body.status || 'pending';

        if (discountAmount > 0) {
            finalTotalAmount = Math.max(0, totalAmount - discountAmount);
        }

        // Create order
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (order_number, customer_name, table_number, total_amount, discount_amount, cash_received, change_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [orderNumber, customer_name || null, table_number || null, finalTotalAmount, discountAmount, cashReceived, changeAmount, payment_method, status]
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
            [orderId, finalTotalAmount, payment_method]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Order created successfully',
            order: {
                id: orderId,
                order_number: orderNumber,
                total_amount: finalTotalAmount,
                status,
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

// Public endpoint to get order status
router.get('/public/:orderNumber', async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const [orders] = await pool.execute(
            'SELECT order_number, status, payment_method, total_amount, created_at, updated_at FROM orders WHERE order_number = ?',
            [orderNumber]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(orders[0]);
    } catch (error) {
        console.error('Get public order error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    body('status').isIn(['pending', 'in_progress', 'ready', 'completed']).withMessage('Invalid status'),
    body('discount_amount').optional().isFloat({ min: 0 }).withMessage('Invalid discount amount'),
    body('cash_received').optional().isFloat({ min: 0 }).withMessage('Invalid cash received'),
    body('change_amount').optional().isFloat({ min: 0 }).withMessage('Invalid change amount'),
    body('payment_method').optional().isIn(['cash', 'gcash']).withMessage('Invalid payment method'),
    body('total_amount').optional().isFloat({ min: 0 }).withMessage('Invalid total amount')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { status, discount_amount, cash_received, change_amount, payment_method, total_amount } = req.body;

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

        // Build update query dynamically
        const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const values = [status];

        if (discount_amount !== undefined) {
            updates.push('discount_amount = ?');
            values.push(discount_amount);
        }
        if (cash_received !== undefined) {
            updates.push('cash_received = ?');
            values.push(cash_received);
        }
        if (change_amount !== undefined) {
            updates.push('change_amount = ?');
            values.push(change_amount);
        }
        if (payment_method !== undefined) {
            updates.push('payment_method = ?');
            values.push(payment_method);
        }
        if (total_amount !== undefined) {
            updates.push('total_amount = ?');
            values.push(total_amount);
        }

        values.push(id);

        await pool.execute(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // If completing an order, and amount changed, update the transaction record too?
        // For simplicity, we assume one transaction per order.
        if (status === 'completed' && (total_amount !== undefined || payment_method !== undefined)) {
            // Update transaction if exists
            const finalAmount = total_amount !== undefined ? total_amount : order.total_amount;
            const finalMethod = payment_method !== undefined ? payment_method : order.payment_method;

            // Check if transaction exists
            const [transactions] = await pool.execute('SELECT id FROM transactions WHERE order_id = ?', [id]);
            if (transactions.length > 0) {
                await pool.execute(
                    'UPDATE transactions SET amount = ?, payment_method = ? WHERE order_id = ?',
                    [finalAmount, finalMethod, id]
                );
            } else {
                // Create transaction if missing (shouldn't happen with current create logic, but good for robustness)
                await pool.execute(
                    'INSERT INTO transactions (order_id, amount, payment_method) VALUES (?, ?, ?)',
                    [id, finalAmount, finalMethod]
                );
            }
        }

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                'status_update',
                'orders',
                id,
                JSON.stringify({ status: order.status, total: order.total_amount }),
                JSON.stringify({ status, total: total_amount })
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
