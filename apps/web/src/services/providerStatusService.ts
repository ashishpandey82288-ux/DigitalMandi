// ==============================================================================
// KisanFlow Web — Provider Status Client
// ==============================================================================

import { apiClient } from './apiClient.ts';
import { ApiResponse, ProviderStatusResponseDTO } from '@kisanflow/types';

export const providerStatusService = {
  async getStatus(): Promise<ProviderStatusResponseDTO> {
    const res = await apiClient.get<ApiResponse<ProviderStatusResponseDTO>>('/providers/status');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch provider status');
    }
    return res.data.data;
  },
};
