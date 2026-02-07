import axios from 'axios';
import type { ApiResponse } from '@farmflow/shared';
import { getIdToken } from './firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  const { data } = await api.get<ApiResponse<T>>(url);
  return data;
}

export async function apiPost<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  return data;
}

export async function apiPut<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const { data } = await api.put<ApiResponse<T>>(url, body);
  return data;
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data;
}

export default api;
