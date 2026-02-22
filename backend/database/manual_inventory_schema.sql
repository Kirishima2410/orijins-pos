-- Create Tables
CREATE TABLE manual_inventory_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_code VARCHAR(20) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0
);

CREATE TABLE manual_inventory_sheets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sheet_date DATE NOT NULL,
    department VARCHAR(100),
    performed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE manual_inventory_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sheet_id INT NOT NULL,
    item_id INT NOT NULL,
    beg_bal DECIMAL(10,2) DEFAULT 0,
    delivery DECIMAL(10,2) DEFAULT 0,
    usage_amount DECIMAL(10,2) DEFAULT 0,
    waste DECIMAL(10,2) DEFAULT 0,
    end_bal DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (sheet_id) REFERENCES manual_inventory_sheets(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES manual_inventory_items(id) ON DELETE CASCADE
);

-- Seed Items
INSERT INTO manual_inventory_items (item_code, description, display_order) VALUES
('OR-001', 'Coffee Beans (Brazil Santos)', 1),
('OR-002', 'Full Cream Milk (Yarra Farm)', 2),
('OR-003', 'Cooking Cream (Master Martini)', 3),
('OR-004', 'Condensed Milk (Doreen)', 4),
('OR-005', 'Sugar Syrup', 5),
('OR-006', 'Crushed Graham (M.Y. San)', 6),
('OR-007', 'Salted Caramel', 7),
('OR-008', 'Cocoa (Hershey)', 8),
('OR-009', 'Oatmilk (Oatside)', 9),
('OR-010', 'Nutella', 10),
('OR-011', 'Matcha (88 Roastery)', 11),
('OR-012', 'Cinnamon (McCormick)', 12),
('OR-013', 'Ube Extract (McCormick)', 13),
('OR-014', '7UP', 14),
('OR-015', 'Biscoff Smooth Spread (Lotus)', 15),
('OR-016', 'Chocolate Syrup (Da Vinci)', 16),
('OR-017', 'White Choco Syrup (Da Vinci)', 17),
('OR-018', 'Blueberry Syrup (Injoy)', 18),
('OR-019', 'Strawberry Syrup (Injoy)', 19),
('OR-020', 'Cheesecake Cream Based', 20),
('OR-021', 'Cheesecake (Powder)', 21),
('OR-022', 'Cream Cheese Salted (Powder)', 22),
('OR-023', '16 oz Cups', 23),
('OR-024', '22 oz Cups', 24),
('OR-025', '12 oz Double Wall Cups', 25),
('OR-026', 'Strawless Lid', 26),
('OR-027', 'White Lid', 27),
('OR-028', 'Straw', 28),
('OR-029', 'Single Plastic Cup Carrier', 29),
('OR-030', 'Double Plastic Cup Carrier', 30),
('OR-031', 'Alcohol', 31),
('OR-032', 'White Sugar', 32);
