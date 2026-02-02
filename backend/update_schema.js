const { pool } = require('./config/database');

async function updateSchema() {
    try {
        console.log('🔄 Starting schema update...');

        // Create dining_tables table
        console.log('📦 Creating dining_tables table...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS dining_tables (
                id INT PRIMARY KEY AUTO_INCREMENT,
                table_number VARCHAR(10) UNIQUE NOT NULL,
                qr_code_url VARCHAR(255),
                capacity INT DEFAULT 4,
                status ENUM('available', 'occupied', 'reserved') DEFAULT 'available',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ dining_tables table created/verified');

        // Check if table_number column exists in orders
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME = 'table_number'
        `);

        if (columns.length === 0) {
            console.log('📝 Adding table_number column to orders table...');
            await pool.execute(`
                ALTER TABLE orders 
                ADD COLUMN table_number VARCHAR(10) NULL AFTER customer_name
            `);
            console.log('✅ table_number column added to orders');
        } else {
            console.log('ℹ️ table_number column already exists in orders');
        }

        console.log('✨ Schema update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Schema update failed:', error);
        process.exit(1);
    }
}

updateSchema();
