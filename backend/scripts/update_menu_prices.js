const { pool } = require('./config/database');

const updates = [
    // CHILL DRINKS 16oz/22oz
    { name: 'Strawberry Cocoa', sizes: { '16oz': 138, '22oz': 158 } },
    { name: 'Blue Ocean Deep', sizes: { '16oz': 128, '22oz': 148 } },
    { name: 'Green Lagoon', sizes: { '16oz': 128, '22oz': 148 } },
    { name: 'Wild Berry Creek', sizes: { '16oz': 128, '22oz': 148 } },
    { name: 'Cold Choco', sizes: { '16oz': 128, '22oz': 148 } },

    // GREENLAND 16oz/22oz
    { name: 'Creamy Matcha Oatmilk', sizes: { '16oz': 128, '22oz': 158 } },
    { name: 'Creamy Matcha Freshmilk', sizes: { '16oz': 128, '22oz': 158 } },
    { name: 'Strawberry Matcha', sizes: { '16oz': 128, '22oz': 158 } },

    // HOT COFFEE 8oz
    { name: 'Hot Latte', sizes: { '8oz': 108 } },
    { name: 'Hot Choco', sizes: { '8oz': 108 } },
    { name: 'Hot Matcha', sizes: { '8oz': 108 } },
    { name: 'Hot Spanish Latte', sizes: { '8oz': 108 } },
    { name: 'Hot Mocha', sizes: { '8oz': 108 } },
    { name: 'Hot Americano', sizes: { '8oz': 108 } },

    // COLD COFFEE 16oz/22oz
    { name: 'Tiramisu Latte', sizes: { '16oz': 138, '22oz': 158 } },
    { name: 'Spanish Latte', sizes: { '16oz': 128, '22oz': 148 } },
    { name: 'Dark Latte', sizes: { '16oz': 138, '22oz': 158 } },
    { name: 'Salted Caramel Latte', sizes: { '16oz': 138, '22oz': 158 } },
    { name: 'Iced Americano', sizes: { '16oz': 118, '22oz': 128 } },
    { name: 'Lotus Biscoff Latte', sizes: { '16oz': 158, '22oz': 178 } },
    { name: 'White Mocha Latte', sizes: { '16oz': 138, '22oz': 158 } },
    { name: 'Cinnamon Latte', sizes: { '16oz': 138, '22oz': 158 } },

    // CHEESECAKE SERIES 16oz/22oz
    { name: 'Nutella Cheesecake', sizes: { '16oz': 148, '22oz': 168 } },
    { name: 'Blueberry Cheesecake', sizes: { '16oz': 148, '22oz': 168 } },
    { name: 'Strawberry Cheesecake', sizes: { '16oz': 148, '22oz': 168 } },
    { name: 'Ube Cheesecake', sizes: { '16oz': 148, '22oz': 168 } }
];

async function updatePrices() {
    try {
        console.log('Starting price updates...');
        for (const item of updates) {
            // Find menu item
            const [rows] = await pool.execute('SELECT * FROM menu_items WHERE name LIKE ?', [`%${item.name}%`]);

            if (rows.length === 0) {
                console.warn(`⚠️ Item not found: ${item.name}`);
                continue;
            }
            if (rows.length > 1) {
                console.warn(`⚠️ Multiple items found for: ${item.name}, using first one (${rows[0].name}).`);
            }

            const menuItem = rows[0];
            const sizeKeys = Object.keys(item.sizes); // e.g., ['16oz', '22oz'] or ['8oz']

            console.log(`Updating ${menuItem.name}...`);

            // Get existing variants
            const [variants] = await pool.execute('SELECT * FROM menu_item_variants WHERE menu_item_id = ? ORDER BY price ASC', [menuItem.id]);

            if (sizeKeys.length === 1) {
                // Single size (8oz)
                const size = sizeKeys[0];
                const price = item.sizes[size];

                if (variants.length > 0) {
                    // Update first variant
                    await pool.execute('UPDATE menu_item_variants SET variant_name = ?, size_label = ?, price = ? WHERE id = ?',
                        [size, size, price, variants[0].id]);
                    console.log(`  Updated variant ${variants[0].id} to ${size} - ₱${price}`);
                } else {
                    // Create new
                    await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
                        [menuItem.id, size, size, price]);
                    console.log(`  Created variant ${size} - ₱${price}`);
                }
            } else if (sizeKeys.length === 2 && sizeKeys.includes('16oz') && sizeKeys.includes('22oz')) {
                // Dual size (16oz, 22oz)
                const price16 = item.sizes['16oz'];
                const price22 = item.sizes['22oz'];

                if (variants.length >= 2) {
                    // Assuming sorted by price ASC: variants[0] is small, variants[1] is large
                    // Even if names are "Slice"/"Whole", we map to 16oz/22oz based on rank

                    await pool.execute('UPDATE menu_item_variants SET variant_name = ?, size_label = ?, price = ? WHERE id = ?',
                        ['16oz', '16oz', price16, variants[0].id]);
                    console.log(`  Updated variant ${variants[0].id} (was ${variants[0].variant_name}) to 16oz - ₱${price16}`);

                    await pool.execute('UPDATE menu_item_variants SET variant_name = ?, size_label = ?, price = ? WHERE id = ?',
                        ['22oz', '22oz', price22, variants[1].id]);
                    console.log(`  Updated variant ${variants[1].id} (was ${variants[1].variant_name}) to 22oz - ₱${price22}`);

                } else {
                    // Not enough variants, wipe and create? Or append?
                    // Let's delete and recreate to be safe if mismatch
                    console.log('  Mismatched variants count. Recreating...');
                    await pool.execute('DELETE FROM menu_item_variants WHERE menu_item_id = ?', [menuItem.id]);

                    await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
                        [menuItem.id, '16oz', '16oz', price16]);
                    await pool.execute('INSERT INTO menu_item_variants (menu_item_id, variant_name, size_label, price) VALUES (?, ?, ?, ?)',
                        [menuItem.id, '22oz', '22oz', price22]);
                    console.log(`  Created 16oz and 22oz variants`);
                }
            }

            // Update base price to lowest variant price (for display purposes if needed)
            const minPrice = Math.min(...Object.values(item.sizes));
            await pool.execute('UPDATE menu_items SET price = ? WHERE id = ?', [minPrice, menuItem.id]);
        }

        console.log('Done.');
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

updatePrices();
