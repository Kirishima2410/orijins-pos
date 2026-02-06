const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get all inventory items
router.get('/', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        const [items] = await pool.execute(
            'SELECT * FROM inventory_items ORDER BY name'
        );
        res.json(items);
    } catch (error) {
        console.error('Get inventory items error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create inventory item
router.post('/', [
    authenticateToken,
    requireRole(['owner', 'admin', 'manager']),
    body('name').notEmpty().withMessage('Name is required'),
    body('stock_quantity').optional().isFloat({ min: 0 }),
    body('cost_per_unit').optional().isFloat({ min: 0 }),
    body('unit').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { name, sku, category, stock_quantity, unit, low_stock_threshold, cost_per_unit } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO inventory_items (name, sku, category, stock_quantity, unit, low_stock_threshold, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, sku || null, category || null, stock_quantity || 0, unit || 'unit', low_stock_threshold || 10, cost_per_unit || 0]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create', 'inventory_items', result.insertId, JSON.stringify(req.body)]
        );

        res.status(201).json({ message: 'Inventory item created', id: result.insertId });
    } catch (error) {
        console.error('Create inventory item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update inventory item details
router.put('/:id', [
    authenticateToken,
    requireRole(['owner', 'admin', 'manager']),
    body('name').notEmpty().withMessage('Name is required')
], async (req, res) => {
    try {
        const { id } = req.params;
        const { name, sku, category, unit, low_stock_threshold, cost_per_unit } = req.body;

        const [oldItems] = await pool.execute('SELECT * FROM inventory_items WHERE id = ?', [id]);
        if (oldItems.length === 0) return res.status(404).json({ error: 'Item not found' });

        await pool.execute(
            'UPDATE inventory_items SET name = ?, sku = ?, category = ?, unit = ?, low_stock_threshold = ?, cost_per_unit = ? WHERE id = ?',
            [name, sku || null, category || null, unit || 'unit', low_stock_threshold || 10, cost_per_unit || 0, id]
        );

        // Log
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'update', 'inventory_items', id, JSON.stringify(oldItems[0]), JSON.stringify(req.body)]
        );

        res.json({ message: 'Inventory item updated' });
    } catch (error) {
        console.error('Update inventory item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update stock (Restock/Adjust)
router.patch('/:id/stock', [
    authenticateToken,
    requireRole(['owner', 'admin', 'manager', 'cashier']),
    body('quantity').isFloat(),
    body('action').isIn(['add', 'subtract', 'set']),
    body('notes').optional().isString()
], async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, action, notes } = req.body;
        const qty = Number(quantity);

        const [items] = await pool.execute('SELECT * FROM inventory_items WHERE id = ?', [id]);
        if (items.length === 0) return res.status(404).json({ error: 'Item not found' });
        const item = items[0];

        let newStock = Number(item.stock_quantity);
        let change = 0;

        switch (action) {
            case 'add':
                newStock += qty;
                change = qty;
                break;
            case 'subtract':
                newStock -= qty;
                change = -qty;
                break;
            case 'set':
                change = qty - newStock;
                newStock = qty;
                break;
        }

        if (newStock < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

        await pool.execute('UPDATE inventory_items SET stock_quantity = ? WHERE id = ?', [newStock, id]);

        // Log inventory change
        await pool.execute(
            'INSERT INTO inventory_logs (inventory_item_id, action_type, quantity_change, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [id, action === 'subtract' ? 'adjustment' : 'restock', change, item.stock_quantity, newStock, notes || null]
        );

        res.json({ message: 'Stock updated', new_stock: newStock });
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete inventory item
router.delete('/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Check if used in recipes
        const [recipes] = await pool.execute('SELECT COUNT(*) as count FROM recipes WHERE inventory_item_id = ?', [id]);
        if (recipes[0].count > 0) return res.status(400).json({ error: 'Cannot delete item used in recipes' });

        const [items] = await pool.execute('SELECT * FROM inventory_items WHERE id = ?', [id]);
        if (items.length === 0) return res.status(404).json({ error: 'Item not found' });

        await pool.execute('DELETE FROM inventory_items WHERE id = ?', [id]);

        // Log
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'delete', 'inventory_items', id, JSON.stringify(items[0])]
        );

        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Delete inventory item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Recipes ---

// Get recipe for menu item
router.get('/recipes/:menuItemId', [authenticateToken], async (req, res) => {
    try {
        const { menuItemId } = req.params;
        const [rows] = await pool.execute(`
            SELECT r.*, i.name as inventory_item_name, i.unit 
            FROM recipes r
            JOIN inventory_items i ON r.inventory_item_id = i.id
            WHERE r.menu_item_id = ?
        `, [menuItemId]);
        res.json(rows);
    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update recipe for menu item (Full replacement)
router.post('/recipes/:menuItemId', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { menuItemId } = req.params;
        const { ingredients } = req.body; // Array of { inventory_item_id, quantity_required }

        await connection.beginTransaction();

        // Delete existing recipe
        await connection.execute('DELETE FROM recipes WHERE menu_item_id = ?', [menuItemId]);

        // Insert new
        if (ingredients && ingredients.length > 0) {
            for (const ing of ingredients) {
                await connection.execute(
                    'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_required) VALUES (?, ?, ?)',
                    [menuItemId, ing.inventory_item_id, ing.quantity_required]
                );
            }
        }

        await connection.commit();
        res.json({ message: 'Recipe updated' });
    } catch (error) {
        await connection.rollback();
        console.error('Update recipe error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

module.exports = router;
