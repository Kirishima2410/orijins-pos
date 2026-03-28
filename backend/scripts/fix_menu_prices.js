const { pool } = require('./config/database');

async function fixPrices() {
    try {
        console.log('Starting price fixes...');

        // 1. Fix Hot Spanish Latte (ID 44) - Should be 8oz only
        console.log('Fixing Hot Spanish Latte (ID 44)...');
        await pool.execute('DELETE FROM menu_item_variants WHERE menu_item_id = 44');
        await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
            [44, '8oz', '8oz', 108]);
        await pool.execute('UPDATE menu_items SET price = 108 WHERE id = 44');
        console.log('  Fixed ID 44 -> 8oz @ 108');

        // 2. Fix Spanish Latte (ID 48) - Should be 16oz/22oz
        console.log('Fixing Spanish Latte (ID 48)...');
        await pool.execute('DELETE FROM menu_item_variants WHERE menu_item_id = 48');
        await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
            [48, '16oz', '16oz', 128]);
        await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
            [48, '22oz', '22oz', 148]);
        await pool.execute('UPDATE menu_items SET price = 128 WHERE id = 48');
        console.log('  Fixed ID 48 -> 16oz/22oz @ 128/148');

        // 3. Create Green Lagoon
        console.log('Creating Green Lagoon...');
        // Check if exists first to avoid dupes if run multiple times
        const [glRows] = await pool.execute('SELECT * FROM menu_items WHERE name = "Green Lagoon"');
        let glId;
        if (glRows.length === 0) {
            // Assume Category 6 (Chill Drinks) based on neighbors
            const [res] = await pool.execute(
                'INSERT INTO menu_items (name, description, category_id, price, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?)',
                ['Green Lagoon', 'Refreshing green lagoon soda.', 6, 128, null, true]
            );
            glId = res.insertId;
            console.log(`  Created Green Lagoon (ID ${glId})`);
        } else {
            glId = glRows[0].id;
            console.log(`  Green Lagoon already exists (ID ${glId})`);
        }

        // Add variants for Green Lagoon
        await pool.execute('DELETE FROM menu_item_variants WHERE menu_item_id = ?', [glId]);
        await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
            [glId, '16oz', '16oz', 128]);
        await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
            [glId, '22oz', '22oz', 148]);
        console.log('  Added variants for Green Lagoon');

        console.log('Fixes completed.');
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixPrices();
