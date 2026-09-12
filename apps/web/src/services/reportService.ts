// ==============================================================================
// KisanFlow — Frontend Reports Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export async function getProcurementReport(params?: {
  startDate?: string;
  endDate?: string;
  centerId?: string;
  cropId?: string;
}) {
  const res = await apiClient.get('/reports/procurement', { params });
  return res.data.data;
}

export async function getPaymentReport(params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  centerId?: string;
}) {
  const res = await apiClient.get('/reports/payments', { params });
  return res.data.data;
}

export async function getQualityReport(params?: {
  startDate?: string;
  endDate?: string;
  centerId?: string;
  cropId?: string;
}) {
  const res = await apiClient.get('/reports/quality', { params });
  return res.data.data;
}

export async function getLogisticsReport(params?: {
  startDate?: string;
  endDate?: string;
  centerId?: string;
  status?: string;
}) {
  const res = await apiClient.get('/reports/logistics', { params });
  return res.data.data;
}

export async function getCenterPerformanceReport(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const res = await apiClient.get('/reports/centers', { params });
  return res.data.data;
}
