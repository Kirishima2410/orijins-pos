const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { testConnection, pool } = require('./config/database');
const { hashPassword } = require('./config/auth');

// Import routes
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const expensesRoutes = require('./routes/expenses');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting (disabled in development by default)
const enableRateLimit = (process.env.RATE_LIMIT_ENABLED || '').toLowerCase() !== 'false' 
    && (process.env.NODE_ENV || 'development') !== 'development' ;

if (enableRateLimit) {
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
    const max = Number(process.env.RATE_LIMIT_MAX || 1000);
    const limiter = rateLimit({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later.'
    });
    app.use(limiter);
}

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/expenses', expensesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
    }
    
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }

        // Seed default staff users if missing (admin/admin123, cashier/cashier123)
        try {
            const [adminRows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
            if (adminRows.length === 0) {
                const adminHash = await hashPassword('admin123');
                await pool.execute(
                    'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
                    ['admin', 'admin@coffeeshop.local', adminHash, 'owner']
                );
                console.log('👤 Seeded default admin user: admin / admin123');
            }

            const [cashierRows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['cashier']);
            if (cashierRows.length === 0) {
                const cashierHash = await hashPassword('cashier123');
                await pool.execute(
                    'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
                    ['cashier', 'cashier@coffeeshop.local', cashierHash, 'cashier']
                );
                console.log('👤 Seeded default cashier user: cashier / cashier123');
            }
        } catch (seedErr) {
            console.error('⚠️ Failed to seed default users:', seedErr.message);
        }

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    process.exit(0);
});

startServer();
