const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Test database connection (no auth required)
router.get('/test-db', async (req, res) => {
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

// Get all categories (public endpoint for customer menu)
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await pool.execute(
            'SELECT id, name, description, display_order FROM categories WHERE is_active = TRUE ORDER BY display_order, name'
        );

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all menu items (public endpoint for customer menu)
router.get('/items', async (req, res) => {
    try {
        const { category_id } = req.query;
        
        let query = `
            SELECT mi.id, mi.name, mi.description, mi.category_id, mi.price, 
                   mi.image_url, mi.is_available, mi.stock_quantity, mi.low_stock_threshold, 
                   c.name as category_name
            FROM menu_items mi
            LEFT JOIN categories c ON mi.category_id = c.id
            WHERE mi.is_available = TRUE
        `;
        
        const params = [];
        if (category_id) {
            query += ' AND mi.category_id = ?';
            params.push(category_id);
        }
        
        query += ' ORDER BY c.display_order, mi.name';

        const [items] = await pool.execute(query, params);

        // fetch variants for all items in a single query
        const itemIds = items.map(i => i.id);
        let variantsByItem = {};
        if (itemIds.length) {
            const [variants] = await pool.query(
                `SELECT id, menu_item_id, variant_name, size_label, price, is_available
                 FROM menu_item_variants
                 WHERE menu_item_id IN (${itemIds.map(() => '?').join(',')})
                 ORDER BY price ASC`,
                itemIds
            );
            for (const v of variants) {
                if (!variantsByItem[v.menu_item_id]) variantsByItem[v.menu_item_id] = [];
                variantsByItem[v.menu_item_id].push({
                    id: v.id,
                    menu_item_id: v.menu_item_id,
                    variant_name: v.variant_name,
                    size_label: v.size_label,
                    price: Number(v.price),
                    is_available: v.is_available
                });
            }
        }

        const normalized = items.map((item) => ({
            ...item,
            price: Number(item.price),
            stock_quantity: item.stock_quantity !== undefined ? Number(item.stock_quantity) : item.stock_quantity,
            low_stock_threshold: item.low_stock_threshold !== undefined ? Number(item.low_stock_threshold) : item.low_stock_threshold,
            variants: variantsByItem[item.id] || []
        }));

        res.json(normalized);
    } catch (error) {
        console.error('Get menu items error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single menu item
router.get('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [items] = await pool.execute(
            `SELECT mi.id, mi.name, mi.description, mi.category_id, mi.price, 
                    mi.image_url, mi.is_available, mi.stock_quantity, 
                    c.name as category_name
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE mi.id = ?`,
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        const item = items[0];
        item.price = Number(item.price);
        if (item.stock_quantity !== undefined) item.stock_quantity = Number(item.stock_quantity);
        if (item.low_stock_threshold !== undefined) item.low_stock_threshold = Number(item.low_stock_threshold);

        res.json(item);
    } catch (error) {
        console.error('Get menu item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin routes for menu management

// Get all categories (admin)
router.get('/admin/categories', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const [categories] = await pool.execute(
            'SELECT * FROM categories ORDER BY display_order, name'
        );

        res.json(categories);
    } catch (error) {
        console.error('Get admin categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new category
router.post('/admin/categories', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional().isString(),
    body('display_order').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, display_order } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)',
            [name, description || null, display_order || 0]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create', 'categories', result.insertId, JSON.stringify({ name, description, display_order })]
        );

        res.status(201).json({
            message: 'Category created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create category error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Category name already exists' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update category
router.put('/admin/categories/:id', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional().isString(),
    body('display_order').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description, display_order } = req.body;

        // Get old values for audit log
        const [oldCategories] = await pool.execute(
            'SELECT * FROM categories WHERE id = ?',
            [id]
        );

        if (oldCategories.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        await pool.execute(
            'UPDATE categories SET name = ?, description = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, description || null, display_order || 0, id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id, 
                'update', 
                'categories', 
                id, 
                JSON.stringify(oldCategories[0]), 
                JSON.stringify({ name, description, display_order })
            ]
        );

        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete category
router.delete('/admin/categories/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category has menu items
        const [items] = await pool.execute(
            'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
            [id]
        );

        if (items[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category that has menu items. Please move or delete the items first.' 
            });
        }

        // Get category for audit log
        const [categories] = await pool.execute(
            'SELECT * FROM categories WHERE id = ?',
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'delete', 'categories', id, JSON.stringify(categories[0])]
        );

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all menu items (admin)
router.get('/admin/items', [authenticateToken, requireRole(['owner', 'admin', 'cashier'])], async (req, res) => {
    try {
        const [items] = await pool.execute(
            `SELECT mi.*, c.name as category_name 
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             ORDER BY c.display_order, mi.name`
        );

        res.json(items);
    } catch (error) {
        console.error('Get admin menu items error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new menu item
router.post('/admin/items', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('name').notEmpty().withMessage('Item name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('category_id').isInt().withMessage('Category is required'),
    body('description').optional().isString(),
    body('stock_quantity').optional().isInt({ min: 0 }),
    body('low_stock_threshold').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, category_id, price, image_url, stock_quantity, low_stock_threshold } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO menu_items (name, description, category_id, price, image_url, stock_quantity, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description || null, category_id, price, image_url || null, stock_quantity || 0, low_stock_threshold || 5]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create', 'menu_items', result.insertId, JSON.stringify({ name, description, category_id, price, stock_quantity, low_stock_threshold })]
        );

        res.status(201).json({
            message: 'Menu item created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update menu item
router.put('/admin/items/:id', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('name').notEmpty().withMessage('Item name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('category_id').isInt().withMessage('Category is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description, category_id, price, image_url, is_available, stock_quantity, low_stock_threshold } = req.body;

        // Get old values for audit log
        const [oldItems] = await pool.execute(
            'SELECT * FROM menu_items WHERE id = ?',
            [id]
        );

        if (oldItems.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        await pool.execute(
            'UPDATE menu_items SET name = ?, description = ?, category_id = ?, price = ?, image_url = ?, is_available = ?, stock_quantity = ?, low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, description || null, category_id, price, image_url || null, is_available !== undefined ? is_available : true, stock_quantity || 0, low_stock_threshold || 5, id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id, 
                'update', 
                'menu_items', 
                id, 
                JSON.stringify(oldItems[0]), 
                JSON.stringify({ name, description, category_id, price, image_url, is_available, stock_quantity, low_stock_threshold })
            ]
        );

        res.json({ message: 'Menu item updated successfully' });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update stock quantity
router.patch('/admin/items/:id/stock', [
    authenticateToken,
    requireRole(['owner', 'admin', 'cashier']),
    body('quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
    body('action').isIn(['set', 'add', 'subtract']).withMessage('Action must be set, add, or subtract'),
    body('notes').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const id = Number(req.params.id);
        const { quantity, action, notes } = req.body;
        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 0) {
            return res.status(400).json({ error: 'Quantity must be a non-negative integer' });
        }

        // Get current item
        const [items] = await pool.execute(
            'SELECT * FROM menu_items WHERE id = ?',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        const item = items[0];
        let newStock = Number(item.stock_quantity || 0);
        let quantityChange = 0;

        switch (action) {
            case 'set':
                quantityChange = qty - newStock;
                if (qty < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
                newStock = qty;
                break;
            case 'add':
                quantityChange = qty;
                newStock = newStock + qty;
                break;
            case 'subtract':
                if (qty > newStock) {
                    return res.status(400).json({ error: 'Cannot subtract more than current stock' });
                }
                quantityChange = -qty;
                newStock = newStock - qty;
                break;
        }

        // Update stock
        await pool.execute(
            'UPDATE menu_items SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStock, id]
        );

        // Log inventory change
        await pool.execute(
            'INSERT INTO inventory_logs (menu_item_id, action_type, quantity_change, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [id, action === 'subtract' ? 'adjustment' : 'restock', quantityChange, Number(item.stock_quantity || 0), newStock, notes || null]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'stock_update', 'menu_items', id, JSON.stringify({ action, quantity_change, new_stock: newStock })]
        );

        res.json({ message: 'Stock updated successfully', new_stock: newStock, quantity_change });
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete menu item
router.delete('/admin/items/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Get item for audit log
        const [items] = await pool.execute(
            'SELECT * FROM menu_items WHERE id = ?',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        await pool.execute('DELETE FROM menu_items WHERE id = ?', [id]);

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'delete', 'menu_items', id, JSON.stringify(items[0])]
        );

        res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
