const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get all tables
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [tables] = await pool.execute(
            'SELECT * FROM dining_tables ORDER BY CAST(REGEXP_SUBSTR(table_number, "[0-9]+") AS UNSIGNED), table_number'
        );
        res.json(tables);
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single table
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [tables] = await pool.execute(
            'SELECT * FROM dining_tables WHERE id = ?',
            [req.params.id]
        );
        if (tables.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }
        res.json(tables[0]);
    } catch (error) {
        console.error('Get table error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create table
router.post('/', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('table_number').notEmpty().withMessage('Table number is required'),
    body('capacity').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['available', 'occupied', 'reserved'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { table_number, capacity, status } = req.body;

        // Check availability
        const [existing] = await pool.execute(
            'SELECT id FROM dining_tables WHERE table_number = ?',
            [table_number]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Table number already exists' });
        }

        const [result] = await pool.execute(
            'INSERT INTO dining_tables (table_number, capacity, status) VALUES (?, ?, ?)',
            [table_number, capacity || 4, status || 'available']
        );

        // Auto-generate QR URL (Assuming frontend runs on same domain/port config or we hardcode for now)
        // In a real app, this should be configurable. 
        // We'll store a relative path or full URL if we know the frontend host.
        // For now, let's just constructing it on the fly in the frontend or returning it dynamically.
        // The column in DB `qr_code_url` can be updated or we can just ignore it and generate on the fly.

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create', 'dining_tables', result.insertId, JSON.stringify({ table_number, capacity, status })]
        );

        res.status(201).json({
            message: 'Table created successfully',
            id: result.insertId,
            table_number
        });
    } catch (error) {
        console.error('Create table error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update table
router.put('/:id', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('table_number').notEmpty().withMessage('Table number is required'),
    body('capacity').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['available', 'occupied', 'reserved'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { table_number, capacity, status, is_active } = req.body;

        const [oldTables] = await pool.execute('SELECT * FROM dining_tables WHERE id = ?', [id]);
        if (oldTables.length === 0) return res.status(404).json({ error: 'Table not found' });

        // Check unique table_number if changed
        if (table_number !== oldTables[0].table_number) {
            const [existing] = await pool.execute(
                'SELECT id FROM dining_tables WHERE table_number = ? AND id != ?',
                [table_number, id]
            );
            if (existing.length > 0) return res.status(400).json({ error: 'Table number already exists' });
        }

        await pool.execute(
            'UPDATE dining_tables SET table_number = ?, capacity = ?, status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [table_number, capacity || 4, status || 'available', is_active !== undefined ? is_active : true, id]
        );

        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'update', 'dining_tables', id, JSON.stringify(oldTables[0]), JSON.stringify(req.body)]
        );

        res.json({ message: 'Table updated successfully' });
    } catch (error) {
        console.error('Update table error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete table
router.delete('/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const [oldTables] = await pool.execute('SELECT * FROM dining_tables WHERE id = ?', [id]);
        if (oldTables.length === 0) return res.status(404).json({ error: 'Table not found' });

        await pool.execute('DELETE FROM dining_tables WHERE id = ?', [id]);

        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'delete', 'dining_tables', id, JSON.stringify(oldTables[0])]
        );

        res.json({ message: 'Table deleted successfully' });
    } catch (error) {
        console.error('Delete table error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
