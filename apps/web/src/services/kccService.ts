// ==============================================================================
// KisanFlow Web — Kisan Credit Card (KCC) Client (data.gov.in via Backend)
// ==============================================================================

import { apiClient } from './apiClient.ts';
import { ApiResponse, KCCAdvisoryDTO, KCCVerificationResultDTO } from '@kisanflow/types';

export const kccService = {
  async getAdvisories(filters?: {
    state?: string;
    district?: string;
    crop?: string;
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<KCCAdvisoryDTO[]> {
    const res = await apiClient.get<ApiResponse<KCCAdvisoryDTO[]>>('/kcc/advisories', {
      params: filters,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch KCC advisories');
    }
    return res.data.data;
  },

  async verifyKCC(kccNumber: string): Promise<KCCVerificationResultDTO> {
    const res = await apiClient.get<ApiResponse<KCCVerificationResultDTO>>(`/kcc/verify/${kccNumber}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to verify KCC number');
    }
    return res.data.data;
  },
};
