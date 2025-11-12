import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- MODIFIKASI DIMULAI DI SINI ---
// API calls sekarang dipisahkan untuk auth dan data
export const authApi = {
  // Anda harus membuat endpoint ini di rest-api (Langkah 1)
  register: (userData: { name: string; email: string; password: string }) => 
    apiClient.post('/api/users/register', userData),
  
  // Anda harus membuat endpoint ini di rest-api (Langkah 1)
  login: (credentials: { email: string; password: string }) =>
    apiClient.post('/api/users/login', credentials),
};

export const userApi = {
  getUsers: () => apiClient.get('/api/users'),
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
  // Fungsi create User asli (jika Anda masih memerlukannya untuk admin)
  createUser: (userData: { name: string; email: string; age: number }) => 
    apiClient.post('/api/users', userData),
  updateUser: (id: string, userData: { name?: string; email?: string; age?: number }) => 
    apiClient.put(`/api/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),
};
// --- MODIFIKASI SELESAI ---