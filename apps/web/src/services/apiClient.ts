// ==============================================================================
// KisanFlow — Axios API Client
// ==============================================================================

import axios from 'axios';

// Dynamically use current host or configured API URL
// Normalizes base URL so both 'https://api.example.com' and 'https://api.example.com/api' work
const envApiUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : (typeof process !== 'undefined' && process.env?.VITE_API_URL
      ? process.env.VITE_API_URL
      : (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api'));
const rawApiUrl = (envApiUrl || '/api').trim();
const normalizedBaseURL =
  rawApiUrl.startsWith('http') && !rawApiUrl.endsWith('/api')
    ? `${rawApiUrl.replace(/\/+$/, '')}/api`
    : rawApiUrl.replace(/\/+$/, '') || '/api';

export const apiClient = axios.create({
  baseURL: normalizedBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Resolves an API path against the configured VITE_API_URL.
 * Supports both relative paths ('/api/auth/me', '/auth/me') and absolute URLs.
 */
export function getApiUrl(endpoint: string = ''): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (normalizedBaseURL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    return `${normalizedBaseURL}${cleanEndpoint.substring(4)}`;
  }
  return `${normalizedBaseURL}${cleanEndpoint}`;
}

// Request interceptor: attach auth token if available (Phase 2)
apiClient.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('kisanflow_auth_token') ||
      localStorage.getItem('kisanflow_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: standard error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Network communication failed';
    return Promise.reject(new Error(message));
  }
);
