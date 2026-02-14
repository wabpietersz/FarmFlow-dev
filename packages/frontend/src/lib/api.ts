import axios from 'axios';
import type { ApiResponse } from '@farmflow/shared';
import { toast } from 'sonner';
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

export async function apiPatch<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data;
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data;
}

/**
 * Get the most useful API error message for UI display.
 */
export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  const axiosErr = error as {
    response?: {
      data?: {
        error?: string;
        code?: string;
        details?: Record<string, string[]>;
      };
    };
  };

  const data = axiosErr?.response?.data;

  if (data?.code === 'VALIDATION_ERROR' && data?.details) {
    const firstField = Object.values(data.details).find((messages) => Array.isArray(messages) && messages.length > 0);
    if (firstField?.[0]) {
      return firstField[0];
    }
  }

  if (data?.error && data.error !== 'Validation failed') {
    return data.error;
  }

  return fallbackMessage;
}

/**
 * Parse an API error and show specific toast messages.
 * Handles: Zod validation field errors, business logic errors, generic fallback.
 */
export function parseApiError(error: unknown, fallbackMessage: string): void {
  const axiosErr = error as {
    response?: {
      data?: {
        error?: string;
        code?: string;
        details?: Record<string, string[]>;
      };
    };
  };

  const data = axiosErr?.response?.data;

  // Case 1: Zod validation errors with field-level details
  if (data?.code === 'VALIDATION_ERROR' && data?.details) {
    const fieldErrors: string[] = [];
    for (const messages of Object.values(data.details)) {
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          fieldErrors.push(msg);
        }
      }
    }
    if (fieldErrors.length > 0) {
      if (fieldErrors.length <= 3) {
        for (const err of fieldErrors) {
          toast.error(err);
        }
      } else {
        toast.error(`Please fix the following:\n${fieldErrors.join('\n')}`);
      }
      return;
    }
  }

  // Case 2: Business logic error with specific message
  if (data?.error && data.error !== 'Validation failed') {
    toast.error(data.error);
    return;
  }

  // Case 3: Fallback
  toast.error(getApiErrorMessage(error, fallbackMessage));
}

export default api;
