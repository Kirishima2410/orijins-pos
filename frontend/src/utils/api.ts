import axios, { AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const requestUrl = (error.config as any)?.url || '';
    if (status === 401) {
      // If this is the login request, show an auth-specific message and do NOT redirect
      if (requestUrl.includes('/auth/login')) {
        toast.error('Invalid username or password');
        return Promise.reject(error);
      }
      // Token expired or invalid for other requests
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/staff/login';
      toast.error('Session expired. Please login again.');
    } else if (status === 403) {
      toast.error('Access denied. Insufficient permissions.');
    } else if (typeof status === 'number' && status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.data) {
      const errorData = error.response.data as any;
      if (errorData.error) {
        toast.error(errorData.error);
      } else if (errorData.errors && errorData.errors.length > 0) {
        errorData.errors.forEach((err: any) => {
          toast.error(err.msg || 'Validation error');
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please try again.');
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),

  verify: () =>
    api.get('/auth/verify'),

  verifyRole: (data: { username: string; password: string; requiredRole?: string }) =>
    api.post('/auth/verify-role', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),

  logout: () =>
    api.post('/auth/logout'),
};

export const menuAPI = {
  // Public endpoints
  getCategories: () =>
    api.get('/menu/categories'),

  getItems: (params?: { category_id?: number }) =>
    api.get('/menu/items', { params }),

  getItem: (id: number) =>
    api.get(`/menu/items/${id}`),

  // Admin endpoints
  getAdminCategories: () =>
    api.get('/menu/admin/categories'),

  createCategory: (data: { name: string; description?: string; display_order?: number }) =>
    api.post('/menu/admin/categories', data),

  updateCategory: (id: number, data: { name: string; description?: string; display_order?: number }) =>
    api.put(`/menu/admin/categories/${id}`, data),

  deleteCategory: (id: number) =>
    api.delete(`/menu/admin/categories/${id}`),

  getAdminItems: () =>
    api.get('/menu/admin/items'),

  createItem: (data: any) =>
    api.post('/menu/admin/items', data),

  updateItem: (id: number, data: any) =>
    api.put(`/menu/admin/items/${id}`, data),

  updateStock: (id: number, data: { quantity: number; action: string; notes?: string }) =>
    api.patch(`/menu/admin/items/${id}/stock`, data),

  deleteItem: (id: number) =>
    api.delete(`/menu/admin/items/${id}`),
};

export const ordersAPI = {
  create: (data: any) =>
    api.post('/orders', data),

  getAll: (params?: any) =>
    api.get('/orders', { params }),

  getById: (id: number) =>
    api.get(`/orders/${id}`),

  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),

  void: (id: number, data: { void_reason: string; admin_username: string; admin_password: string }) =>
    api.post(`/orders/${id}/void`, data),

  getTodayStats: () =>
    api.get('/orders/stats/today'),

  getPublicStatus: (orderNumber: string) =>
    api.get(`/orders/public/${orderNumber}`),
};

export const usersAPI = {
  getAll: (params?: any) =>
    api.get('/users', { params }),

  getById: (id: number) =>
    api.get(`/users/${id}`),

  create: (data: any) =>
    api.post('/users', data),

  update: (id: number, data: any) =>
    api.put(`/users/${id}`, data),

  resetPassword: (id: number, data: { new_password: string }) =>
    api.post(`/users/${id}/reset-password`, data),

  delete: (id: number) =>
    api.delete(`/users/${id}`),

  getRoles: () =>
    api.get('/users/roles/list'),

  getProfile: () =>
    api.get('/users/profile/me'),

  updateProfile: (data: { username: string; email: string }) =>
    api.put('/users/profile/me', data),
};

export const expensesAPI = {
  getAll: (params?: any) =>
    api.get('/expenses', { params }),

  create: (data: { description: string; amount: number; category?: string; expense_date: string }) =>
    api.post('/expenses', data),

  update: (id: number, data: { description: string; amount: number; category?: string; expense_date: string }) =>
    api.put(`/expenses/${id}`, data),

  delete: (id: number) =>
    api.delete(`/expenses/${id}`),
};

export const dashboardAPI = {
  getOverview: () =>
    api.get('/dashboard/overview'),

  getSalesChart: (period?: string) =>
    api.get('/dashboard/sales-chart', { params: { period } }),

  getInventory: () =>
    api.get('/dashboard/inventory'),

  getActivity: (limit?: number) =>
    api.get('/dashboard/activity', { params: { limit } }),

  getQuickStats: () =>
    api.get('/dashboard/quick-stats'),
};

export const reportsAPI = {
  getSales: (params: { date_from: string; date_to: string; group_by?: string }) =>
    api.get('/reports/sales', { params }),

  getOrders: (params: { date_from: string; date_to: string }) =>
    api.get('/reports/orders', { params }),

  getTopItems: (params: { date_from: string; date_to: string; limit?: number }) =>
    api.get('/reports/top-items', { params }),

  getInventory: () =>
    api.get('/reports/inventory'),

  getAuditLogs: (params?: any) =>
    api.get('/reports/audit-logs', { params }),
};

export const settingsAPI = {
  getAll: () =>
    api.get('/settings'),

  getByKey: (key: string) =>
    api.get(`/settings/${key}`),

  update: (key: string, data: { value: any }) =>
    api.put(`/settings/${key}`, data),

  updateMultiple: (data: { settings: Record<string, any> }) =>
    api.put('/settings', data),

  getShopInfo: () =>
    api.get('/settings/public/shop-info'),

  reset: () =>
    api.post('/settings/reset'),
};

export const tablesAPI = {
  getAll: () =>
    api.get('/tables'),

  getById: (id: number) =>
    api.get(`/tables/${id}`),

  create: (data: { table_number: string; capacity?: number; status?: string }) =>
    api.post('/tables', data),

  update: (id: number, data: { table_number: string; capacity?: number; status?: string; is_active?: boolean }) =>
    api.put(`/tables/${id}`, data),

  delete: (id: number) =>
    api.delete(`/tables/${id}`),
};

export const inventoryAPI = {
  getItems: () =>
    api.get('/inventory/items'),

  submitSheet: (data: { sheet_date: string; department: string; entries: any[] }) =>
    api.post('/inventory/sheets', data),

  getSheets: (params?: { limit?: number; offset?: number }) =>
    api.get('/inventory/sheets', { params }),

  getSheetById: (id: number) =>
    api.get(`/inventory/sheets/${id}`),

  getLatestBalances: () =>
    api.get('/inventory/latest-balances'),
};

export default api;
