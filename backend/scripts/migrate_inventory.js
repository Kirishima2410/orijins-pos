const { pool } = require('./config/database');

async function migrateInventory() {
    console.log('🔄 Starting Inventory System Migration...');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create inventory_items table
        console.log('📦 Creating inventory_items table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                sku VARCHAR(100) UNIQUE,
                category VARCHAR(100),
                stock_quantity DECIMAL(10, 2) DEFAULT 0.00,
                unit VARCHAR(50) DEFAULT 'unit',
                low_stock_threshold DECIMAL(10, 2) DEFAULT 10.00,
                cost_per_unit DECIMAL(10, 2) DEFAULT 0.00,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2. Create recipes table
        console.log('📜 Creating recipes table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS recipes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                menu_item_id INT NOT NULL,
                menu_item_variant_id INT NULL,
                inventory_item_id INT NOT NULL,
                quantity_required DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
                FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
            )
        `);

        // 3. Migrate distinct menu items to inventory items (1:1 mapping for now)
        console.log('🚚 Migrating existing menu stock to inventory items...');

        // Get all menu items
        const [menuItems] = await connection.execute('SELECT id, name, stock_quantity, low_stock_threshold FROM menu_items');

        for (const item of menuItems) {
            // Check if inventory item already exists (by name)
            const [existing] = await connection.execute('SELECT id FROM inventory_items WHERE name = ?', [item.name]);

            let inventoryId;

            if (existing.length === 0) {
                // Create new inventory item
                const [result] = await connection.execute(
                    'INSERT INTO inventory_items (name, stock_quantity, low_stock_threshold) VALUES (?, ?, ?)',
                    [item.name, item.stock_quantity || 0, item.low_stock_threshold || 10]
                );
                inventoryId = result.insertId;
                console.log(`   + Created inventory item: ${item.name}`);
            } else {
                inventoryId = existing[0].id;
                console.log(`   . Linked to existing inventory item: ${item.name}`);
            }

            // Create 1:1 recipe
            // Check if recipe exists
            const [existingRecipe] = await connection.execute(
                'SELECT id FROM recipes WHERE menu_item_id = ? AND inventory_item_id = ?',
                [item.id, inventoryId]
            );

            if (existingRecipe.length === 0) {
                await connection.execute(
                    'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_required) VALUES (?, ?, ?)',
                    [item.id, inventoryId, 1.00]
                );
            }
        }

        // 4. Update order_items and inventory_logs to reference inventory_items? 
        // For now, we will leave historical data as is, but new logic will use the new tables.
        // However, we might want to update inventory_logs to have an inventory_item_id column for future logs.

        console.log('📝 Updating inventory_logs table...');
        const [logColumns] = await connection.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_logs' AND COLUMN_NAME = 'inventory_item_id'
        `);

        if (logColumns.length === 0) {
            await connection.execute(`
                ALTER TABLE inventory_logs 
                ADD COLUMN inventory_item_id INT NULL AFTER menu_item_id,
                ADD CONSTRAINT fk_inventory_logs_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
            `);
            console.log('   + Added inventory_item_id to inventory_logs');
        }

        await connection.commit();
        console.log('✨ Inventory System Migration Completed Successfully!');
        process.exit(0);

    } catch (error) {
        await connection.rollback();
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        connection.release();
    }
}

migrateInventory();
