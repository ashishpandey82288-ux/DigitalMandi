// ==============================================================================
// KisanFlow Web — Mandi Price Discovery Client (data.gov.in via Backend)
// ==============================================================================

import { apiClient } from './apiClient.ts';
import { ApiResponse, MandiPriceResponseDTO } from '@kisanflow/types';

export const mandiService = {
  async getMandiPrices(filters?: {
    commodity?: string;
    state?: string;
    district?: string;
    market?: string;
    limit?: number;
  }): Promise<MandiPriceResponseDTO> {
    const res = await apiClient.get<ApiResponse<MandiPriceResponseDTO>>('/mandi/prices', {
      params: filters,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch mandi prices');
    }
    return res.data.data;
  },

  async getMandiPriceByCommodity(commodity: string): Promise<MandiPriceResponseDTO> {
    const res = await apiClient.get<ApiResponse<MandiPriceResponseDTO>>(`/mandi/prices/${commodity}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || `Failed to fetch mandi prices for ${commodity}`);
    }
    return res.data.data;
  },
};
