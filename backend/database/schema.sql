-- Coffee Shop POS Database Schema
-- Run this script in MySQL Workbench to create the database and tables

CREATE DATABASE IF NOT EXISTS coffee_shop_pos;
USE coffee_shop_pos;

-- Users table for staff authentication and roles
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('owner', 'admin', 'cashier') NOT NULL DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table for menu organization
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Menu items table
CREATE TABLE menu_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    stock_quantity INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Orders table
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'gcash') NOT NULL,
    status ENUM('pending', 'in_progress', 'ready', 'completed', 'voided') DEFAULT 'pending',
    is_voided BOOLEAN DEFAULT FALSE,
    void_reason TEXT,
    voided_by INT,
    voided_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Order items table
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- Transactions table for payment records
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'gcash') NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Expenses table for business expense tracking
CREATE TABLE expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    expense_date DATE NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Inventory tracking table
CREATE TABLE inventory_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    menu_item_id INT NOT NULL,
    action_type ENUM('sale', 'restock', 'adjustment') NOT NULL,
    quantity_change INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_order_id INT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Audit logs table for system activity tracking
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Settings table for system configuration
CREATE TABLE settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('shop_name', 'Coffee Shop POS', 'string', 'Name of the coffee shop'),
('shop_address', '123 Main Street, City, Country', 'string', 'Shop address'),
('shop_phone', '+1-234-567-8900', 'string', 'Shop phone number'),
('shop_email', 'info@coffeeshop.com', 'string', 'Shop email address'),
('business_hours', '{"monday": "7:00-18:00", "tuesday": "7:00-18:00", "wednesday": "7:00-18:00", "thursday": "7:00-18:00", "friday": "7:00-18:00", "saturday": "8:00-17:00", "sunday": "9:00-16:00"}', 'json', 'Business hours for each day'),
('tax_rate', '0.12', 'number', 'Tax rate as decimal (12% = 0.12)'),
('currency', 'PHP', 'string', 'Currency code'),
('currency_symbol', '₱', 'string', 'Currency symbol'),
('order_number_prefix', 'ORD', 'string', 'Prefix for order numbers'),
('low_stock_threshold', '5', 'number', 'Default low stock threshold'),
('gcash_number', '+63-XXX-XXX-XXXX', 'string', 'GCash phone number'),
('gcash_qr_code', '', 'string', 'Path to GCash QR code image'),
('receipt_footer', 'Thank you for your business!', 'string', 'Footer text for receipts'),
('enable_notifications', 'true', 'boolean', 'Enable system notifications'),
('session_timeout', '3600', 'number', 'Session timeout in seconds (1 hour)');

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@coffeeshop.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner');

-- Insert sample categories
INSERT INTO categories (name, description, display_order) VALUES
('Coffee', 'Hot and cold coffee beverages', 1),
('Tea', 'Various tea selections', 2),
('Pastries', 'Fresh baked goods', 3),
('Sandwiches', 'Fresh sandwiches and wraps', 4),
('Smoothies', 'Fresh fruit smoothies', 5);

-- Insert sample menu items
INSERT INTO menu_items (name, description, category_id, price, stock_quantity) VALUES
('Americano', 'Rich and bold black coffee', 1, 120.00, 50),
('Cappuccino', 'Espresso with steamed milk and foam', 1, 150.00, 30),
('Latte', 'Espresso with steamed milk', 1, 160.00, 25),
('Mocha', 'Espresso with chocolate and steamed milk', 1, 170.00, 20),
('Green Tea', 'Traditional green tea', 2, 80.00, 40),
('Black Tea', 'Classic black tea', 2, 80.00, 35),
('Croissant', 'Buttery flaky pastry', 3, 60.00, 15),
('Chocolate Muffin', 'Rich chocolate muffin', 3, 70.00, 12),
('Chicken Sandwich', 'Grilled chicken with lettuce and tomato', 4, 180.00, 8),
('Turkey Wrap', 'Sliced turkey with vegetables', 4, 190.00, 6),
('Strawberry Smoothie', 'Fresh strawberry smoothie', 5, 140.00, 20),
('Mango Smoothie', 'Tropical mango smoothie', 5, 140.00, 18);

-- Create indexes for better performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX idx_inventory_logs_menu_item_id ON inventory_logs(menu_item_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
