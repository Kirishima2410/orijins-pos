const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// List expenses with filters
router.get('/', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { search, category, date_from, date_to, min_amount, max_amount, page = 1, limit = 20 } = req.query;

        let query = 'SELECT e.*, u.username AS created_by_username FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (e.description LIKE ? OR e.category LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (category) {
            query += ' AND e.category = ?';
            params.push(category);
        }
        if (date_from) {
            query += ' AND e.expense_date >= ?';
            params.push(date_from);
        }
        if (date_to) {
            query += ' AND e.expense_date <= ?';
            params.push(date_to);
        }
        if (min_amount) {
            query += ' AND e.amount >= ?';
            params.push(Number(min_amount));
        }
        if (max_amount) {
            query += ' AND e.amount <= ?';
            params.push(Number(max_amount));
        }

        query += ' ORDER BY e.expense_date DESC, e.created_at DESC';

        const safeLimit = Math.min(Number(limit) || 20, 500);
        const offset = Math.max(0, (Number(page) - 1) * safeLimit);
        query += ` LIMIT ${safeLimit} OFFSET ${offset}`;

        const [rows] = await pool.execute(query, params);

        // totals
        let sumQuery = 'SELECT SUM(amount) AS total, COUNT(*) as count FROM expenses WHERE 1=1';
        const sumParams = [];
        if (search) { sumQuery += ' AND (description LIKE ? OR category LIKE ?)'; sumParams.push(`%${search}%`, `%${search}%`); }
        if (category) { sumQuery += ' AND category = ?'; sumParams.push(category); }
        if (date_from) { sumQuery += ' AND expense_date >= ?'; sumParams.push(date_from); }
        if (date_to) { sumQuery += ' AND expense_date <= ?'; sumParams.push(date_to); }
        if (min_amount) { sumQuery += ' AND amount >= ?'; sumParams.push(Number(min_amount)); }
        if (max_amount) { sumQuery += ' AND amount <= ?'; sumParams.push(Number(max_amount)); }
        const [sumRows] = await pool.execute(sumQuery, sumParams);

        res.json({
            expenses: rows,
            total_amount: sumRows[0].total || 0,
            total_count: sumRows[0].count || 0,
            pagination: { page: Number(page), limit: Number(limit) }
        });
    } catch (err) {
        console.error('List expenses error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create expense
router.post('/', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('description').isLength({ min: 2 }).withMessage('Description is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('expense_date').isISO8601().withMessage('Valid date is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { description, amount, category, expense_date } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO expenses (description, amount, category, expense_date, created_by) VALUES (?, ?, ?, ?, ?)',
            [description, amount, category || null, expense_date, req.user.id]
        );
        res.status(201).json({ id: result.insertId, message: 'Expense created' });
    } catch (err) {
        console.error('Create expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update expense
router.put('/:id', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('description').isLength({ min: 2 }).withMessage('Description is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('expense_date').isISO8601().withMessage('Valid date is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { description, amount, category, expense_date } = req.body;

        await pool.execute(
            'UPDATE expenses SET description = ?, amount = ?, category = ?, expense_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [description, amount, category || null, expense_date, id]
        );
        res.json({ message: 'Expense updated' });
    } catch (err) {
        console.error('Update expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete expense
router.delete('/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error('Delete expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;


