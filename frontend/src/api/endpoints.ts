import api from './client';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; name: string; role?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// Customers
export const customersApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/customers', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/customers/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post('/customers', data).then((r) => r.data),
  update: (id: string, data: unknown) => api.put(`/customers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// Leads
export const leadsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/leads', { params }).then((r) => r.data),
  funnel: () => api.get('/leads/funnel').then((r) => r.data),
  get: (id: string) => api.get(`/leads/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post('/leads', data).then((r) => r.data),
  update: (id: string, data: unknown) => api.put(`/leads/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

// Products
export const productsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/products', { params }).then((r) => r.data),
  categories: () => api.get('/products/categories').then((r) => r.data),
  get: (id: string) => api.get(`/products/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post('/products', data).then((r) => r.data),
  update: (id: string, data: unknown) => api.put(`/products/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Orders
export const ordersApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/orders', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post('/orders', data).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }).then((r) => r.data),
  delete: (id: string) => api.delete(`/orders/${id}`),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then((r) => r.data),
};

// Health
export const healthApi = {
  check: () => api.get('/health').then((r) => r.data),
};
