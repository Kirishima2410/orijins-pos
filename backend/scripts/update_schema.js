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

        // Check for discount and payment amount columns
        const [discountCol] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME = 'discount_amount'
        `);

        if (discountCol.length === 0) {
            console.log('📝 Adding discount and payment columns to orders table...');
            await pool.execute(`
                ALTER TABLE orders 
                ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount,
                ADD COLUMN cash_received DECIMAL(10,2) DEFAULT 0.00 AFTER payment_method,
                ADD COLUMN change_amount DECIMAL(10,2) DEFAULT 0.00 AFTER cash_received
            `);
            console.log('✅ Discount and payment columns added to orders');
        } else {
            console.log('ℹ️ Discount and payment columns already exist in orders');
        }

        // Update users role enum
        console.log('📝 Updating users role enum...');
        try {
            await pool.execute(`
                ALTER TABLE users 
                MODIFY COLUMN role ENUM('admin', 'manager', 'cashier') NOT NULL DEFAULT 'cashier'
            `);
            console.log('✅ Users role enum updated');
        } catch (error) {
            console.log('ℹ️ Users role enum update skipped (might already be up to date)');
        }

        // Check for details column in audit_logs
        const [auditDetailsCol] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'audit_logs' 
            AND COLUMN_NAME = 'details'
        `);

        if (auditDetailsCol.length === 0) {
            console.log('📝 Adding details column to audit_logs table...');
            await pool.execute(`
                ALTER TABLE audit_logs 
                ADD COLUMN details TEXT NULL AFTER user_agent
            `);
            console.log('✅ details column added to audit_logs');
        } else {
            console.log('ℹ️ details column already exists in audit_logs');
        }

        // Add unit_of_measurement to manual_inventory_items
        const [unitCol] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'manual_inventory_items' 
            AND COLUMN_NAME = 'unit_of_measurement'
        `);

        if (unitCol.length === 0) {
            console.log('📝 Adding unit_of_measurement column to manual_inventory_items table...');
            await pool.execute(`
                ALTER TABLE manual_inventory_items 
                ADD COLUMN unit_of_measurement VARCHAR(20) DEFAULT NULL AFTER description
            `);
            console.log('✅ unit_of_measurement column added to items');
        } else {
            console.log('ℹ️ unit_of_measurement column already exists in items');
        }

        const [entryUnitCol2] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'manual_inventory_entries' 
            AND COLUMN_NAME = 'beg_bal_unit'
        `);

        if (entryUnitCol2.length === 0) {
            console.log('📝 Adding specific unit columns to manual_inventory_entries table...');
            await pool.execute(`
                ALTER TABLE manual_inventory_entries 
                ADD COLUMN beg_bal_unit VARCHAR(20) DEFAULT 'g' AFTER beg_bal,
                ADD COLUMN delivery_unit VARCHAR(20) DEFAULT 'g' AFTER delivery,
                ADD COLUMN usage_unit VARCHAR(20) DEFAULT 'g' AFTER usage_amount,
                ADD COLUMN waste_unit VARCHAR(20) DEFAULT 'g' AFTER waste,
                ADD COLUMN end_bal_unit VARCHAR(20) DEFAULT 'g' AFTER end_bal
            `);
            console.log('✅ Specific unit columns added to entries');
        } else {
            console.log('ℹ️ Specific unit columns already exist in entries');
        }

        console.log('✨ Schema update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Schema update failed:', error);
        process.exit(1);
    }
}

updateSchema();
