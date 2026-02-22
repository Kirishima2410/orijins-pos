const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get predefined inventory items
router.get('/items', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        const [items] = await pool.execute(
            'SELECT * FROM manual_inventory_items WHERE is_active = TRUE ORDER BY display_order'
        );
        res.json(items);
    } catch (error) {
        console.error('Get inventory items error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit a new manual inventory sheet
router.post('/sheets', [
    authenticateToken,
    requireRole(['owner', 'admin', 'manager', 'cashier']),
    body('sheet_date').isDate().withMessage('Valid sheet date is required'),
    body('department').notEmpty().withMessage('Department is required'),
    body('entries').isArray({ min: 1 }).withMessage('At least one entry is required'),
    body('entries.*.item_id').isInt().withMessage('Valid Item ID is required'),
    body('entries.*.beg_bal').optional().isFloat({ min: 0 }),
    body('entries.*.delivery').optional().isFloat({ min: 0 }),
    body('entries.*.usage_amount').optional().isFloat({ min: 0 }),
    body('entries.*.waste').optional().isFloat({ min: 0 }),
    body('entries.*.end_bal').optional().isFloat({ min: 0 })
], async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        await connection.beginTransaction();

        const { sheet_date, department, entries } = req.body;
        const performed_by = req.user.id;

        // 1. Create the master sheet
        const [sheetResult] = await connection.execute(
            'INSERT INTO manual_inventory_sheets (sheet_date, department, performed_by) VALUES (?, ?, ?)',
            [sheet_date, department, performed_by]
        );
        const sheetId = sheetResult.insertId;

        // 2. Insert all entries
        for (const entry of entries) {
            const beg_bal = entry.beg_bal || 0;
            const delivery = entry.delivery || 0;
            const usage_amount = entry.usage_amount || 0;
            const waste = entry.waste || 0;
            const entry_end_bal = entry.end_bal !== undefined ? parseFloat(entry.end_bal) : ((parseFloat(beg_bal) + parseFloat(delivery)) - (parseFloat(usage_amount) + parseFloat(waste)));
            const beg_bal_unit = entry.beg_bal_unit || 'g';
            const delivery_unit = entry.delivery_unit || 'g';
            const usage_unit = entry.usage_unit || 'g';
            const waste_unit = entry.waste_unit || 'g';
            const end_bal_unit = entry.end_bal_unit || 'g';

            await connection.execute(
                `INSERT INTO manual_inventory_entries 
                (sheet_id, item_id, beg_bal, delivery, usage_amount, waste, end_bal, beg_bal_unit, delivery_unit, usage_unit, waste_unit, end_bal_unit) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sheetId, entry.item_id, beg_bal, delivery, usage_amount, waste, entry_end_bal, beg_bal_unit, delivery_unit, usage_unit, waste_unit, end_bal_unit]
            );
        }

        // Log activity
        await connection.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'submit_inventory_sheet', 'manual_inventory_sheets', sheetId, JSON.stringify({ sheet_date, department, total_entries: entries.length })]
        );

        await connection.commit();
        res.status(201).json({ message: 'Inventory sheet submitted successfully', sheetId });
    } catch (error) {
        await connection.rollback();
        console.error('Submit inventory sheet error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Get historical sheets (metadata only)
router.get('/sheets', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const [sheets] = await pool.execute(`
            SELECT 
                s.id, s.sheet_date, s.department, s.created_at,
                u.username as performed_by_name,
                (SELECT COUNT(*) FROM manual_inventory_entries e WHERE e.sheet_id = s.id) as item_count
            FROM manual_inventory_sheets s
            LEFT JOIN users u ON s.performed_by = u.id
            ORDER BY s.sheet_date DESC, s.created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        res.json(sheets);
    } catch (error) {
        console.error('Get inventory sheets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific sheet by date (latest for that date)
router.get('/sheets/by-date/:date', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        const { date } = req.params;

        // Get sheet metadata
        const [sheets] = await pool.execute(`
            SELECT s.*, u.username as performed_by_name
            FROM manual_inventory_sheets s
            LEFT JOIN users u ON s.performed_by = u.id
            WHERE s.sheet_date = ?
            ORDER BY s.created_at DESC
            LIMIT 1
        `, [date]);

        if (sheets.length === 0) return res.status(404).json({ error: 'Sheet not found' });
        const sheet = sheets[0];

        // Get all entries with item details
        const [entries] = await pool.execute(`
            SELECT 
                e.*, 
                i.item_code, i.description, i.category
            FROM manual_inventory_entries e
            JOIN manual_inventory_items i ON e.item_id = i.id
            WHERE e.sheet_id = ?
            ORDER BY i.display_order
        `, [sheet.id]);

        sheet.entries = entries;
        res.json(sheet);
    } catch (error) {
        console.error('Get inventory sheet by date error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific sheet with all entries
router.get('/sheets/:id', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Get sheet metadata
        const [sheets] = await pool.execute(`
            SELECT s.*, u.username as performed_by_name
            FROM manual_inventory_sheets s
            LEFT JOIN users u ON s.performed_by = u.id
            WHERE s.id = ?
        `, [id]);

        if (sheets.length === 0) return res.status(404).json({ error: 'Sheet not found' });
        const sheet = sheets[0];

        // Get all entries with item details
        const [entries] = await pool.execute(`
            SELECT 
                e.*, 
                i.item_code, i.description, i.category
            FROM manual_inventory_entries e
            JOIN manual_inventory_items i ON e.item_id = i.id
            WHERE e.sheet_id = ?
            ORDER BY i.display_order
        `, [id]);

        sheet.entries = entries;
        res.json(sheet);
    } catch (error) {
        console.error('Get inventory sheet details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get the most recent ending balances to pre-fill the next sheet's beginning balances
router.get('/latest-balances', [authenticateToken, requireRole(['owner', 'admin', 'manager', 'cashier'])], async (req, res) => {
    try {
        // Find the most recent sheet ID
        const [latestSheet] = await pool.execute(
            'SELECT id FROM manual_inventory_sheets ORDER BY sheet_date DESC, created_at DESC LIMIT 1'
        );

        if (latestSheet.length === 0) {
            return res.json({}); // No previous sheets
        }

        const sheetId = latestSheet[0].id;

        // Get ending balances from that sheet
        const [balances] = await pool.execute(
            'SELECT item_id, end_bal FROM manual_inventory_entries WHERE sheet_id = ?',
            [sheetId]
        );

        // Convert array to an object: { itemId: end_bal } for easy frontend lookup
        const balanceMap = {};
        balances.forEach(b => {
            // ensure it's returned as a clean number/string representing the remaining balance
            balanceMap[b.item_id] = parseFloat(b.end_bal);
        });

        res.json(balanceMap);
    } catch (error) {
        console.error('Get latest balances error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
