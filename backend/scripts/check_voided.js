require('dotenv').config();
const { pool } = require('./config/database');
const fs = require('fs');

async function check() {
    try {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const today = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        
        const [rows] = await pool.execute("SELECT id, status, is_voided, created_at, DATE(created_at) as date_created FROM orders ORDER BY created_at DESC LIMIT 10");

        const [voidedOrders] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM orders 
             WHERE DATE(created_at) = ? AND (is_voided = TRUE OR status = 'voided')`,
            [today]
        );
        
        fs.writeFileSync('output.json', JSON.stringify({ today, rows, voidedCount: voidedOrders[0] }, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
