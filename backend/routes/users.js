const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole, hashPassword, comparePassword } = require('../config/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { search, role } = req.query;
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        
        let query = 'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE 1=1';
        const params = [];
        
        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }
        
        query += ' ORDER BY created_at DESC';

        // Add pagination (inline sanitized numbers to avoid binding issues in LIMIT/OFFSET)
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 20;
        const offset = Math.max(0, (page - 1) * safeLimit);
        query += ` LIMIT ${safeLimit} OFFSET ${offset}`;

        const [users] = await pool.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const countParams = [];
        
        if (search) {
            countQuery += ' AND (username LIKE ? OR email LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }
        
        if (role) {
            countQuery += ' AND role = ?';
            countParams.push(role);
        }

        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            users,
            pagination: {
            page,
            limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single user
router.get('/:id', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.execute(
            'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user
router.post('/', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['owner', 'admin', 'cashier']).withMessage('Invalid role')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, role } = req.body;

        // Check if username or email already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, role]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'create', 'users', result.insertId, JSON.stringify({ username, email, role })]
        );

        res.status(201).json({
            message: 'User created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user
router.put('/:id', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['owner', 'admin', 'cashier']).withMessage('Invalid role'),
    body('is_active').isBoolean().withMessage('Active status must be boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { username, email, role, is_active } = req.body;

        // Get old values for audit log
        const [oldUsers] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        if (oldUsers.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if username or email already exists (excluding current user)
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
            [username, email, id]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Update user
        await pool.execute(
            'UPDATE users SET username = ?, email = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [username, email, role, is_active, id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                'update',
                'users',
                id,
                JSON.stringify(oldUsers[0]),
                JSON.stringify({ username, email, role, is_active })
            ]
        );

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset user password
router.post('/:id/reset-password', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { new_password } = req.body;

        // Check if user exists
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const passwordHash = await hashPassword(new_password);

        // Update password
        await pool.execute(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'reset_password', 'users', id, JSON.stringify({ password_reset: true })]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (soft delete - deactivate)
router.delete('/:id', [authenticateToken, requireRole(['owner'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Check if trying to delete self
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Get user for audit log
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Soft delete (deactivate)
        await pool.execute(
            'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                'delete',
                'users',
                id,
                JSON.stringify(users[0]),
                JSON.stringify({ is_active: false })
            ]
        );

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user roles for dropdown
router.get('/roles/list', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const roles = [
            { value: 'cashier', label: 'Cashier' },
            { value: 'admin', label: 'Admin' },
            { value: 'owner', label: 'Owner' }
        ];

        res.json(roles);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
router.get('/profile/me', [authenticateToken], async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await pool.execute(
            'SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update current user profile
router.put('/profile/me', [
    authenticateToken,
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.id;
        const { username, email } = req.body;

        // Check if username or email already exists (excluding current user)
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
            [username, email, userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Update user
        await pool.execute(
            'UPDATE users SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [username, email, userId]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
