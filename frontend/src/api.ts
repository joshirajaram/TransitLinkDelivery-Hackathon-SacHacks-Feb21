import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth types
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Types matching backend models
export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price_cents: number;
}

export interface Restaurant {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  delivery_fee_cents: number;
  menu_items: MenuItem[];
}

export interface Stop {
  id: number;
  code: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
}

export interface Window {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
}

export interface BusLocation {
  vehicle_id: string;
  route_tag: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed_kmh?: number | null;
  last_reported_epoch_ms?: number | null;
}

export interface OrderItem {
  menu_item_id: number;
  menu_item_name: string;
  quantity: number;
  price_cents: number;
}

export interface Order {
  id: number;
  student_id: number;
  restaurant_id: number;
  restaurant_name: string;
  stop: Stop;
  window: Window;
  total_price_cents: number;
  delivery_fee_cents: number;
  status: string;
  bus_id?: string | null;
  qr_code: string;
  created_at: string;
  items: OrderItem[];
}

export interface CreateOrderRequest {
  student_id: number;
  restaurant_id: number;
  stop_id: number;
  window_id: number;
  items: { menu_item_id: number; quantity: number }[];
}

// API functions
export const login = (credentials: LoginRequest) => 
  api.post<LoginResponse>('/auth/login', credentials).then(res => res.data);

export const googleAuth = (token: string) =>
  api.post<LoginResponse>('/auth/google', { token }).then(res => res.data);

export const getMe = () => 
  api.get<User>('/auth/me').then(res => res.data);

export const apiClient = {
  getRestaurants: () => api.get<Restaurant[]>('/restaurants'),
  getMyRestaurant: () => api.get<Restaurant>('/restaurants/my-restaurant'),
  getStops: () => api.get<Stop[]>('/stops'),
  getWindows: () => api.get<Window[]>('/windows'),
  createOrder: (data: CreateOrderRequest) => api.post<Order>('/orders', data),
  getOrder: (orderId: number) => api.get<Order>(`/orders/${orderId}`),
  getMyOrders: () => api.get<Order[]>('/orders/my'),
  getRestaurantOrders: (restaurantId: number) => api.get<Order[]>(`/restaurants/${restaurantId}/orders`),
  updateOrderStatus: (orderId: number, status: string) => api.patch<Order>(`/orders/${orderId}/status`, { status }),
  stewardScan: (qrCode: string) => api.post<Order>('/steward/scan', { qr_code: qrCode }),
  getDashboardData: () => api.get('/admin/dashboard'),
  getBusLocations: () => api.get<BusLocation[]>('/bus-locations'),
};
