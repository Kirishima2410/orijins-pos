// User types
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'cashier';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'cashier';
}

// Category types
export interface Category {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Menu item types
export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  category_id: number;
  category_name?: string;
  price: number; // base price (may be 0 if variants are used)
  image_url?: string;
  is_available: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  variants?: MenuItemVariant[];
}

export interface MenuItemVariant {
  id: number;
  menu_item_id: number;
  variant_name?: string; // e.g., 16oz, 22oz, Slice, Whole
  size_label?: string;
  price: number;
  is_available?: boolean;
}

// Order types
export interface OrderItem {
  id?: number;
  menu_item_id: number;
  menu_item_variant_id?: number;
  variant_name?: string;
  size_label?: string;
  menu_item_name?: string;
  menu_item_description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name?: string;
  total_amount: number;
  payment_method: 'cash' | 'gcash';
  status: 'pending' | 'in_progress' | 'ready' | 'completed' | 'voided';
  is_voided: boolean;
  void_reason?: string;
  voided_by?: number;
  voided_at?: string;
  items: OrderItem[];
  item_count?: number;
  items_summary?: string;
  created_at: string;
  updated_at: string;
}

// Transaction types
export interface Transaction {
  id: number;
  order_id: number;
  amount: number;
  payment_method: 'cash' | 'gcash';
  transaction_date: string;
}

// Dashboard types
export interface DashboardOverview {
  today_sales: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
  };
  pending_orders: number;
  low_stock_alerts: number;
  recent_orders: Order[];
  payment_breakdown: Array<{
    payment_method: 'cash' | 'gcash';
    count: number;
    amount: number;
  }>;
  top_items: Array<{
    name: string;
    category_name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
}

// Cart types
export interface CartItem {
  menu_item: MenuItem;
  variant?: MenuItemVariant;
  quantity: number;
}

// Settings types
export interface Settings {
  shop_name: {
    value: string;
    type: 'string';
    description: string;
  };
  shop_address: {
    value: string;
    type: 'string';
    description: string;
  };
  shop_phone: {
    value: string;
    type: 'string';
    description: string;
  };
  shop_email: {
    value: string;
    type: 'string';
    description: string;
  };
  business_hours: {
    value: Record<string, string>;
    type: 'json';
    description: string;
  };
  tax_rate: {
    value: number;
    type: 'number';
    description: string;
  };
  currency: {
    value: string;
    type: 'string';
    description: string;
  };
  currency_symbol: {
    value: string;
    type: 'string';
    description: string;
  };
  order_number_prefix: {
    value: string;
    type: 'string';
    description: string;
  };
  low_stock_threshold: {
    value: number;
    type: 'number';
    description: string;
  };
  gcash_number: {
    value: string;
    type: 'string';
    description: string;
  };
  gcash_qr_code: {
    value: string;
    type: 'string';
    description: string;
  };
  receipt_footer: {
    value: string;
    type: 'string';
    description: string;
  };
  enable_notifications: {
    value: boolean;
    type: 'boolean';
    description: string;
  };
  session_timeout: {
    value: number;
    type: 'number';
    description: string;
  };
}

export interface ShopInfo {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  business_hours: Record<string, string>;
  currency_symbol: string;
  gcash_number: string;
  gcash_qr_code: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    msg: string;
    param: string;
    location: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Form types
export interface LoginForm {
  username: string;
  password: string;
}

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  role: 'owner' | 'admin' | 'cashier';
}

export interface CreateCategoryForm {
  name: string;
  description?: string;
  display_order?: number;
}

export interface CreateMenuItemForm {
  name: string;
  description?: string;
  category_id: number;
  price: number;
  image_url?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
}

export interface CreateOrderForm {
  items: Array<{
    menu_item_id: number;
    quantity: number;
  }>;
  payment_method: 'cash' | 'gcash';
  customer_name?: string;
}

// Report types
export interface SalesReport {
  summary: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    min_order_value: number;
    max_order_value: number;
  };
  sales_by_date: Array<{
    period: string;
    order_count: number;
    revenue: number;
    avg_order_value: number;
  }>;
  sales_by_payment: Array<{
    payment_method: 'cash' | 'gcash';
    order_count: number;
    revenue: number;
    percentage: number;
  }>;
  sales_by_category: Array<{
    category_name: string;
    order_count: number;
    total_quantity: number;
    revenue: number;
  }>;
  date_range: {
    from: string;
    to: string;
  };
  group_by: string;
}

export interface OrdersReport {
  summary: {
    total_orders: number;
    completed_orders: number;
    voided_orders: number;
    active_orders: number;
    avg_preparation_time: number;
  };
  orders_by_status: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  orders_by_hour: Array<{
    hour: number;
    order_count: number;
  }>;
  daily_orders: Array<{
    date: string;
    order_count: number;
    completed_count: number;
    voided_count: number;
  }>;
  date_range: {
    from: string;
    to: string;
  };
}

export interface TopItemsReport {
  top_by_quantity: Array<{
    id: number;
    name: string;
    category_name: string;
    total_quantity: number;
    total_revenue: number;
    avg_price: number;
    order_count: number;
  }>;
  top_by_revenue: Array<{
    id: number;
    name: string;
    category_name: string;
    total_quantity: number;
    total_revenue: number;
    avg_price: number;
    order_count: number;
  }>;
  unsold_items: Array<{
    id: number;
    name: string;
    category_name: string;
    price: number;
  }>;
  date_range: {
    from: string;
    to: string;
  };
  limit: number;
}

// Chart data types
export interface ChartDataPoint {
  period: string;
  revenue: number;
  order_count: number;
}

export interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

// Inventory types
export interface InventoryLog {
  id: number;
  menu_item_id: number;
  action_type: 'sale' | 'restock' | 'adjustment';
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_order_id?: number;
  notes?: string;
  created_at: string;
}

// Audit log types
export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  table_name?: string;
  record_id?: number;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}
