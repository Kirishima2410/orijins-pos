-- ============================================================
-- Orijins POS -- Complete Database Schema
-- Run this file on a fresh MySQL instance to set up the database.
-- All tables, columns, and seed data are fully up to date.
-- ============================================================

CREATE DATABASE IF NOT EXISTS coffee_shop_pos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE coffee_shop_pos;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin', 'manager', 'cashier') NOT NULL DEFAULT 'cashier',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE categories (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    display_order INT DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: menu_items
-- ============================================================
CREATE TABLE menu_items (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    category_id         INT,
    price               DECIMAL(10,2) NOT NULL,
    image_url           VARCHAR(255),
    is_available        BOOLEAN DEFAULT TRUE,
    stock_quantity      INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: menu_item_variants
-- Size/variant options per menu item (e.g. Small/Medium/Large)
-- ============================================================
CREATE TABLE menu_item_variants (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    menu_item_id  INT NOT NULL,
    variant_name  VARCHAR(100),
    size_label    VARCHAR(50),
    price         DECIMAL(10,2) NOT NULL,
    is_available  BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: dining_tables
-- Physical tables in the shop with QR code support
-- ============================================================
CREATE TABLE dining_tables (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    table_number  VARCHAR(10) UNIQUE NOT NULL,
    qr_code_url   VARCHAR(255),
    capacity      INT DEFAULT 4,
    status        ENUM('available', 'occupied', 'reserved') DEFAULT 'available',
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE orders (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    customer_name   VARCHAR(100),
    table_number    VARCHAR(10) NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    payment_method  ENUM('cash', 'gcash') NOT NULL,
    cash_received   DECIMAL(10,2) DEFAULT 0.00,
    change_amount   DECIMAL(10,2) DEFAULT 0.00,
    is_vat_applied  BOOLEAN DEFAULT FALSE,
    vatable_sales   DECIMAL(10,2) DEFAULT 0.00,
    vat_amount      DECIMAL(10,2) DEFAULT 0.00,
    status          ENUM('pending', 'in_progress', 'ready', 'completed', 'voided') DEFAULT 'pending',
    is_voided       BOOLEAN DEFAULT FALSE,
    void_reason     TEXT,
    voided_by       INT,
    voided_at       TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE order_items (
    id                    INT PRIMARY KEY AUTO_INCREMENT,
    order_id              INT NOT NULL,
    menu_item_id          INT NOT NULL,
    menu_item_variant_id  INT NULL,
    variant_name          VARCHAR(100),
    size_label            VARCHAR(50),
    quantity              INT NOT NULL,
    unit_price            DECIMAL(10,2) NOT NULL,
    total_price           DECIMAL(10,2) NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)             REFERENCES orders(id)             ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id)         REFERENCES menu_items(id)         ON DELETE CASCADE,
    FOREIGN KEY (menu_item_variant_id) REFERENCES menu_item_variants(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: transactions
-- Payment records linked to orders
-- ============================================================
CREATE TABLE transactions (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    order_id        INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    payment_method  ENUM('cash', 'gcash') NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: expenses
-- Business expense tracking
-- ============================================================
CREATE TABLE expenses (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    description  VARCHAR(255) NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    category     VARCHAR(100),
    expense_date DATE NOT NULL,
    created_by   INT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: inventory_logs
-- Tracks every stock change for menu items
-- ============================================================
CREATE TABLE inventory_logs (
    id                 INT PRIMARY KEY AUTO_INCREMENT,
    menu_item_id       INT NOT NULL,
    action_type        ENUM('sale', 'restock', 'adjustment') NOT NULL,
    quantity_change    INT NOT NULL,
    previous_stock     INT NOT NULL,
    new_stock          INT NOT NULL,
    reference_order_id INT NULL,
    notes              TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id)       REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_order_id) REFERENCES orders(id)     ON DELETE SET NULL
);

-- ============================================================
-- TABLE: audit_logs
-- System-wide activity audit trail
-- ============================================================
CREATE TABLE audit_logs (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT,
    action     VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id  INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: settings
-- Runtime configuration key-value store
-- ============================================================
CREATE TABLE settings (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    setting_key   VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type  ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description   TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: manual_inventory_items
-- Predefined list of raw ingredients / supplies to track
-- ============================================================
CREATE TABLE manual_inventory_items (
    id                 INT PRIMARY KEY AUTO_INCREMENT,
    item_code          VARCHAR(20) UNIQUE NOT NULL,
    description        VARCHAR(255) NOT NULL,
    unit_of_measurement VARCHAR(20) DEFAULT NULL,
    category           VARCHAR(100),
    is_active          BOOLEAN DEFAULT TRUE,
    display_order      INT DEFAULT 0
);

-- ============================================================
-- TABLE: manual_inventory_sheets
-- A daily inventory count session
-- ============================================================
CREATE TABLE manual_inventory_sheets (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    sheet_date   DATE NOT NULL,
    department   VARCHAR(100),
    performed_by INT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: manual_inventory_entries
-- Individual item counts within a sheet
-- ============================================================
CREATE TABLE manual_inventory_entries (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    sheet_id      INT NOT NULL,
    item_id       INT NOT NULL,
    beg_bal       DECIMAL(10,2) DEFAULT 0,
    beg_bal_unit  VARCHAR(20) DEFAULT 'g',
    delivery      DECIMAL(10,2) DEFAULT 0,
    delivery_unit VARCHAR(20) DEFAULT 'g',
    usage_amount  DECIMAL(10,2) DEFAULT 0,
    usage_unit    VARCHAR(20) DEFAULT 'g',
    waste         DECIMAL(10,2) DEFAULT 0,
    waste_unit    VARCHAR(20) DEFAULT 'g',
    end_bal       DECIMAL(10,2) DEFAULT 0,
    end_bal_unit  VARCHAR(20) DEFAULT 'g',
    FOREIGN KEY (sheet_id) REFERENCES manual_inventory_sheets(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)  REFERENCES manual_inventory_items(id)  ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_orders_created_at        ON orders(created_at);
CREATE INDEX idx_orders_is_voided         ON orders(is_voided);
CREATE INDEX idx_order_items_order_id     ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX idx_transactions_order_id    ON transactions(order_id);
CREATE INDEX idx_menu_items_category_id   ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_available  ON menu_items(is_available);
CREATE INDEX idx_inventory_logs_item_id   ON inventory_logs(menu_item_id);
CREATE INDEX idx_audit_logs_user_id       ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at    ON audit_logs(created_at);

-- ============================================================
-- SEED: Default admin users
-- Passwords (bcrypt): admin123
-- ============================================================
INSERT INTO users (username, password_hash, role) VALUES
('admin',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('cashier', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cashier');

-- ============================================================
-- SEED: Default settings
-- ============================================================
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('shop_name',           'Orijins',                                  'string',  'Name of the shop'),
('shop_address',        '',                                          'string',  'Shop address'),
('shop_phone',          '',                                          'string',  'Shop phone number'),
('shop_email',          '',                                          'string',  'Shop email address'),
('business_hours',      '{"monday":"7:00-18:00","tuesday":"7:00-18:00","wednesday":"7:00-18:00","thursday":"7:00-18:00","friday":"7:00-18:00","saturday":"8:00-17:00","sunday":"9:00-16:00"}', 'json', 'Business hours per day'),
('tax_rate',            '0.12',                                      'number',  'VAT rate as decimal (12% = 0.12)'),
('currency',            'PHP',                                       'string',  'Currency code'),
('currency_symbol',     '₱',                                         'string',  'Currency symbol'),
('order_number_prefix', 'ORD',                                       'string',  'Prefix for order numbers'),
('low_stock_threshold', '5',                                         'number',  'Default low stock alert threshold'),
('gcash_number',        '',                                          'string',  'GCash phone number for payments'),
('gcash_qr_code',       '',                                          'string',  'Path or URL to GCash QR code image'),
('receipt_footer',      'Thank you for visiting Orijins!',           'string',  'Footer message printed on receipts'),
('enable_notifications','true',                                      'boolean', 'Enable system notifications'),
('session_timeout',     '3600',                                      'number',  'Session timeout in seconds (1 hour)');

-- ============================================================
-- SEED: Manual inventory items (Orijins ingredients & supplies)
-- ============================================================
INSERT INTO manual_inventory_items (item_code, description, display_order) VALUES
('OR-001', 'Coffee Beans (Brazil Santos)',       1),
('OR-002', 'Full Cream Milk (Yarra Farm)',        2),
('OR-003', 'Cooking Cream (Master Martini)',      3),
('OR-004', 'Condensed Milk (Doreen)',             4),
('OR-005', 'Sugar Syrup',                        5),
('OR-006', 'Crushed Graham (M.Y. San)',          6),
('OR-007', 'Salted Caramel',                     7),
('OR-008', 'Cocoa (Hershey)',                    8),
('OR-009', 'Oatmilk (Oatside)',                  9),
('OR-010', 'Nutella',                           10),
('OR-011', 'Matcha (88 Roastery)',              11),
('OR-012', 'Cinnamon (McCormick)',              12),
('OR-013', 'Ube Extract (McCormick)',           13),
('OR-014', '7UP',                               14),
('OR-015', 'Biscoff Smooth Spread (Lotus)',     15),
('OR-016', 'Chocolate Syrup (Da Vinci)',        16),
('OR-017', 'White Choco Syrup (Da Vinci)',      17),
('OR-018', 'Blueberry Syrup (Injoy)',           18),
('OR-019', 'Strawberry Syrup (Injoy)',          19),
('OR-020', 'Cheesecake Cream Based',            20),
('OR-021', 'Cheesecake (Powder)',               21),
('OR-022', 'Cream Cheese Salted (Powder)',      22),
('OR-023', '16 oz Cups',                        23),
('OR-024', '22 oz Cups',                        24),
('OR-025', '12 oz Double Wall Cups',            25),
('OR-026', 'Strawless Lid',                     26),
('OR-027', 'White Lid',                         27),
('OR-028', 'Straw',                             28),
('OR-029', 'Single Plastic Cup Carrier',        29),
('OR-030', 'Double Plastic Cup Carrier',        30),
('OR-031', 'Alcohol',                           31),
('OR-032', 'White Sugar',                       32);

-- ============================================================
-- SEED: Categories (real Orijins menu categories)
-- ============================================================
INSERT INTO categories (name, description, display_order, is_active) VALUES
('CHILL DRINKS',          'Iced fruit & soda mixes',   1, TRUE),
('GREENLAND (Matcha Drinks)', 'Matcha-based beverages', 2, TRUE),
('HOT COFFEE',            'Hot espresso drinks',        3, TRUE),
('COLD COFFEE',           'Iced espresso drinks',       4, TRUE),
('CHEESECAKE SERIES',     'Cheesecakes',                5, TRUE);

-- ============================================================
-- SEED: Menu items (real Orijins menu items)
-- Category IDs match the order inserted above:
--   1 = CHILL DRINKS
--   2 = GREENLAND (Matcha Drinks)
--   3 = HOT COFFEE
--   4 = COLD COFFEE
--   5 = CHEESECAKE SERIES
-- ============================================================

-- CHILL DRINKS
INSERT INTO menu_items (name, category_id, price, is_available, stock_quantity) VALUES
('Blue Ocean Deep',   1, 128.00, TRUE, 0),
('Cold Choco',        1, 128.00, TRUE, 0),
('Green Lagoon',      1, 128.00, TRUE, 0),
('Strawberry Cocoa',  1, 138.00, TRUE, 0),
('Wild Berry Creek',  1, 128.00, TRUE, 0);

-- GREENLAND (Matcha Drinks)
INSERT INTO menu_items (name, category_id, price, is_available, stock_quantity) VALUES
('Creamy Matcha Freshmilk', 2, 128.00, TRUE, 0),
('Creamy Matcha Oatmilk',   2, 128.00, TRUE, 0),
('Strawberry Matcha',       2, 128.00, TRUE, 0);

-- HOT COFFEE
INSERT INTO menu_items (name, category_id, price, is_available, stock_quantity) VALUES
('Hot Americano',    3, 108.00, TRUE, 0),
('Hot Choco',        3, 108.00, TRUE, 0),
('Hot Latte',        3, 108.00, TRUE, 0),
('Hot Matcha',       3, 108.00, TRUE, 0),
('Hot Mocha',        3, 108.00, TRUE, 0),
('Hot Spanish Latte',3, 108.00, TRUE, 0);

-- COLD COFFEE
INSERT INTO menu_items (name, category_id, price, is_available, stock_quantity) VALUES
('Cinnamon Latte',      4, 138.00, TRUE, 0),
('Dark Latte',          4, 138.00, TRUE, 0),
('Iced Americano',      4, 118.00, TRUE, 0),
('Lotus Biscoff Latte', 4, 158.00, TRUE, 0),
('Salted Caramel Latte',4, 138.00, TRUE, 0),
('Spanish Latte',       4, 128.00, TRUE, 0),
('Tiramisu Latte',      4, 138.00, TRUE, 0),
('White Mocha Latte',   4, 138.00, TRUE, 0);

-- CHEESECAKE SERIES
INSERT INTO menu_items (name, category_id, price, is_available, stock_quantity) VALUES
('Blueberry Cheesecake',  5, 148.00, TRUE, 0),
('Nutella Cheesecake',    5, 148.00, TRUE, 0),
('Strawberry Cheesecake', 5, 148.00, TRUE, 0),
('Ube Cheesecake',        5, 148.00, TRUE, 0);
