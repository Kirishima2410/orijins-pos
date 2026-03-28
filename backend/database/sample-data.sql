-- ============================================================
-- Orijins POS -- Supplemental Sample Data (OPTIONAL)
-- ============================================================
-- This file is OPTIONAL. It is NOT needed for a fresh deployment.
-- The main schema.sql already seeds all required data.
--
-- Only run this if you want to pre-load test orders and expenses
-- for development/testing purposes.
-- ============================================================

USE coffee_shop_pos;

-- NOTE: This assumes categories and menu items have already been
-- added via the Admin > Menu Management page. Adjust IDs as needed.

-- Sample expenses for testing
INSERT INTO expenses (description, amount, category, expense_date, created_by) VALUES
('Coffee beans purchase',  2500.00, 'Inventory',  CURDATE(), 1),
('Milk delivery',           800.00, 'Inventory',  CURDATE(), 1),
('Electricity bill',       1200.00, 'Utilities',  CURDATE(), 1),
('Cleaning supplies',       300.00, 'Supplies',   CURDATE(), 1);
