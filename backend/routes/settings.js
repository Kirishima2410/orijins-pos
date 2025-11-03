const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../config/auth');

const router = express.Router();

// Get all settings
router.get('/', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const [settings] = await pool.execute(
            'SELECT * FROM settings ORDER BY setting_key'
        );

        // Convert settings array to object for easier frontend consumption
        const settingsObj = {};
        settings.forEach(setting => {
            let value = setting.setting_value;
            
            // Parse JSON values
            if (setting.setting_type === 'json' && value) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.error('Error parsing JSON setting:', setting.setting_key, e);
                }
            }
            // Parse number values
            else if (setting.setting_type === 'number' && value) {
                value = parseFloat(value);
            }
            // Parse boolean values
            else if (setting.setting_type === 'boolean' && value) {
                value = value === 'true';
            }

            settingsObj[setting.setting_key] = {
                value,
                type: setting.setting_type,
                description: setting.description
            };
        });

        res.json(settingsObj);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single setting
router.get('/:key', [authenticateToken, requireRole(['owner', 'admin'])], async (req, res) => {
    try {
        const { key } = req.params;

        const [settings] = await pool.execute(
            'SELECT * FROM settings WHERE setting_key = ?',
            [key]
        );

        if (settings.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        const setting = settings[0];
        let value = setting.setting_value;
        
        // Parse value based on type
        if (setting.setting_type === 'json' && value) {
            try {
                value = JSON.parse(value);
            } catch (e) {
                console.error('Error parsing JSON setting:', key, e);
            }
        } else if (setting.setting_type === 'number' && value) {
            value = parseFloat(value);
        } else if (setting.setting_type === 'boolean' && value) {
            value = value === 'true';
        }

        res.json({
            key: setting.setting_key,
            value,
            type: setting.setting_type,
            description: setting.description
        });
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update setting
router.put('/:key', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('value').notEmpty().withMessage('Setting value is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { key } = req.params;
        const { value } = req.body;

        // Get current setting to validate type
        const [settings] = await pool.execute(
            'SELECT * FROM settings WHERE setting_key = ?',
            [key]
        );

        if (settings.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        const setting = settings[0];
        let processedValue = value;

        // Process value based on setting type
        if (setting.setting_type === 'json') {
            processedValue = JSON.stringify(value);
        } else if (setting.setting_type === 'number') {
            if (isNaN(value)) {
                return res.status(400).json({ error: 'Value must be a number' });
            }
            processedValue = value.toString();
        } else if (setting.setting_type === 'boolean') {
            processedValue = value ? 'true' : 'false';
        } else {
            processedValue = value.toString();
        }

        // Update setting
        await pool.execute(
            'UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
            [processedValue, key]
        );

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [
                req.user.id,
                'update',
                'settings',
                setting.id,
                JSON.stringify({ value: setting.setting_value }),
                JSON.stringify({ value: processedValue })
            ]
        );

        res.json({ message: 'Setting updated successfully' });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update multiple settings
router.put('/', [
    authenticateToken,
    requireRole(['owner', 'admin']),
    body('settings').isObject().withMessage('Settings object is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { settings } = req.body;

        // Get all current settings to validate types
        const [currentSettings] = await pool.execute(
            'SELECT * FROM settings WHERE setting_key IN (?)',
            [Object.keys(settings)]
        );

        const settingsMap = {};
        currentSettings.forEach(setting => {
            settingsMap[setting.setting_key] = setting;
        });

        const updates = [];
        const auditLogs = [];

        for (const [key, value] of Object.entries(settings)) {
            if (!settingsMap[key]) {
                return res.status(400).json({ error: `Setting '${key}' not found` });
            }

            const setting = settingsMap[key];
            let processedValue = value;

            // Process value based on setting type
            if (setting.setting_type === 'json') {
                processedValue = JSON.stringify(value);
            } else if (setting.setting_type === 'number') {
                if (isNaN(value)) {
                    return res.status(400).json({ error: `Value for '${key}' must be a number` });
                }
                processedValue = value.toString();
            } else if (setting.setting_type === 'boolean') {
                processedValue = value ? 'true' : 'false';
            } else {
                processedValue = value.toString();
            }

            updates.push([processedValue, key]);
            auditLogs.push([
                req.user.id,
                'update',
                'settings',
                setting.id,
                JSON.stringify({ value: setting.setting_value }),
                JSON.stringify({ value: processedValue })
            ]);
        }

        // Update all settings
        for (const [value, key] of updates) {
            await pool.execute(
                'UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
                [value, key]
            );
        }

        // Log all changes
        for (const logData of auditLogs) {
            await pool.execute(
                'INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
                logData
            );
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop information (public endpoint for customer interface)
router.get('/public/shop-info', async (req, res) => {
    try {
        const [settings] = await pool.execute(
            `SELECT setting_key, setting_value, setting_type 
             FROM settings 
             WHERE setting_key IN ('shop_name', 'shop_address', 'shop_phone', 'shop_email', 'business_hours', 'currency_symbol', 'gcash_number', 'gcash_qr_code')`
        );

        const shopInfo = {};
        settings.forEach(setting => {
            let value = setting.setting_value;
            
            if (setting.setting_type === 'json' && value) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.error('Error parsing JSON setting:', setting.setting_key, e);
                }
            }

            shopInfo[setting.setting_key] = value;
        });

        res.json(shopInfo);
    } catch (error) {
        console.error('Get shop info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset settings to default (owner only)
router.post('/reset', [authenticateToken, requireRole(['owner'])], async (req, res) => {
    try {
        // Get default settings
        const defaultSettings = {
            'shop_name': 'Coffee Shop POS',
            'shop_address': '123 Main Street, City, Country',
            'shop_phone': '+1-234-567-8900',
            'shop_email': 'info@coffeeshop.com',
            'business_hours': '{"monday": "7:00-18:00", "tuesday": "7:00-18:00", "wednesday": "7:00-18:00", "thursday": "7:00-18:00", "friday": "7:00-18:00", "saturday": "8:00-17:00", "sunday": "9:00-16:00"}',
            'tax_rate': '0.12',
            'currency': 'PHP',
            'currency_symbol': '₱',
            'order_number_prefix': 'ORD',
            'low_stock_threshold': '5',
            'gcash_number': '+63-XXX-XXX-XXXX',
            'gcash_qr_code': '',
            'receipt_footer': 'Thank you for your business!',
            'enable_notifications': 'true',
            'session_timeout': '3600'
        };

        // Get current settings for audit log
        const [currentSettings] = await pool.execute('SELECT * FROM settings');

        // Reset settings
        for (const [key, value] of Object.entries(defaultSettings)) {
            await pool.execute(
                'UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
                [value, key]
            );
        }

        // Log activity
        await pool.execute(
            'INSERT INTO audit_logs (user_id, action, table_name, old_values, new_values) VALUES (?, ?, ?, ?, ?)',
            [
                req.user.id,
                'reset_settings',
                'settings',
                JSON.stringify(currentSettings.reduce((acc, setting) => {
                    acc[setting.setting_key] = setting.setting_value;
                    return acc;
                }, {})),
                JSON.stringify(defaultSettings)
            ]
        );

        res.json({ message: 'Settings reset to default successfully' });
    } catch (error) {
        console.error('Reset settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
