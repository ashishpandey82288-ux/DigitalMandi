// ==============================================================================
// KisanFlow — Health Check Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface HealthData {
  service: string;
  status: string;
  version: string;
  timestamp: string;
  environment: string;
  checks?: {
    database?: string;
    redis?: string;
    mlService?: string;
  };
}

export async function fetchHealthStatus(detailed: boolean = false): Promise<HealthData> {
  const response = await apiClient.get('/health', {
    params: { detailed },
  });
  return response.data.data;
}
