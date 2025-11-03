-- Sample data for Coffee Shop POS
-- Run this after running schema.sql

USE coffee_shop_pos;

-- Insert additional sample users
INSERT INTO users (username, email, password_hash, role) VALUES
('cashier', 'cashier@coffeeshop.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cashier'),
('manager', 'manager@coffeeshop.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Insert additional menu items
INSERT INTO menu_items (name, description, category_id, price, stock_quantity) VALUES
('Espresso', 'Rich and intense coffee shot', 1, 80.00, 100),
('Macchiato', 'Espresso with a dollop of foamed milk', 1, 130.00, 40),
('Frappuccino', 'Blended coffee drink with ice', 1, 180.00, 30),
('Iced Coffee', 'Cold brewed coffee served over ice', 1, 120.00, 50),
('Chamomile Tea', 'Relaxing herbal tea', 2, 60.00, 25),
('Earl Grey', 'Classic black tea with bergamot', 2, 70.00, 35),
('Green Tea Latte', 'Matcha green tea with steamed milk', 2, 140.00, 20),
('Chai Latte', 'Spiced tea with steamed milk', 2, 150.00, 25),
('Blueberry Muffin', 'Fresh blueberry muffin', 3, 75.00, 15),
('Cinnamon Roll', 'Sweet cinnamon pastry', 3, 85.00, 12),
('Chocolate Chip Cookie', 'Fresh baked chocolate chip cookie', 3, 45.00, 20),
('Bagel with Cream Cheese', 'Toasted bagel with cream cheese', 3, 90.00, 10),
('BLT Sandwich', 'Bacon, lettuce, and tomato sandwich', 4, 200.00, 8),
('Veggie Wrap', 'Fresh vegetables in a tortilla wrap', 4, 160.00, 6),
('Chicken Caesar Salad', 'Fresh salad with grilled chicken', 4, 180.00, 5),
('Quinoa Bowl', 'Healthy quinoa bowl with vegetables', 4, 170.00, 4),
('Banana Smoothie', 'Fresh banana smoothie', 5, 130.00, 25),
('Berry Smoothie', 'Mixed berry smoothie', 5, 140.00, 20),
('Protein Smoothie', 'Protein-packed smoothie', 5, 160.00, 15),
('Green Smoothie', 'Healthy green smoothie', 5, 150.00, 18);

-- Insert some sample orders
INSERT INTO orders (order_number, customer_name, total_amount, payment_method, status) VALUES
('ORD-001001-ABC', 'John Doe', 250.00, 'cash', 'completed'),
('ORD-001002-DEF', 'Jane Smith', 180.00, 'gcash', 'completed'),
('ORD-001003-GHI', 'Mike Johnson', 320.00, 'cash', 'in_progress'),
('ORD-001004-JKL', 'Sarah Wilson', 150.00, 'gcash', 'pending');

-- Insert order items for the sample orders
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price) VALUES
-- Order 1 items
(1, 1, 2, 120.00, 240.00), -- 2 Americanos
(1, 7, 1, 60.00, 60.00),  -- 1 Croissant
-- Order 2 items
(2, 3, 1, 160.00, 160.00), -- 1 Latte
(2, 8, 1, 70.00, 70.00),   -- 1 Chocolate Muffin
-- Order 3 items
(3, 2, 2, 150.00, 300.00), -- 2 Cappuccinos
(3, 9, 1, 180.00, 180.00), -- 1 Chicken Sandwich
-- Order 4 items
(4, 5, 1, 80.00, 80.00),   -- 1 Green Tea
(4, 10, 1, 190.00, 190.00); -- 1 Turkey Wrap

-- Insert corresponding transactions
INSERT INTO transactions (order_id, amount, payment_method) VALUES
(1, 250.00, 'cash'),
(2, 180.00, 'gcash'),
(3, 320.00, 'cash'),
(4, 150.00, 'gcash');

-- Insert some sample expenses
INSERT INTO expenses (description, amount, category, expense_date, created_by) VALUES
('Coffee beans purchase', 2500.00, 'Inventory', '2024-01-15', 1),
('Milk delivery', 800.00, 'Inventory', '2024-01-16', 1),
('Electricity bill', 1200.00, 'Utilities', '2024-01-17', 1),
('Cleaning supplies', 300.00, 'Supplies', '2024-01-18', 1);

-- Update some menu items to have low stock for testing alerts
UPDATE menu_items SET stock_quantity = 2 WHERE id IN (8, 10);
UPDATE menu_items SET stock_quantity = 0 WHERE id = 12;
