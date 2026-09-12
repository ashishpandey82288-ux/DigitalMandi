// ==============================================================================
// KisanFlow — Axios API Client
// ==============================================================================

import axios from 'axios';

// Dynamically use current host or configured API URL
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

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
