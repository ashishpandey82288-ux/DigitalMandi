// ==============================================================================
// KisanFlow Web — Weather Service Client (Open-Meteo via Backend Proxy)
// ==============================================================================

import { apiClient } from './apiClient.ts';
import { ApiResponse, WeatherDataDTO } from '@kisanflow/types';

export const weatherService = {
  async getWeather(latitude?: number, longitude?: number): Promise<WeatherDataDTO> {
    const params: Record<string, number> = {};
    if (latitude !== undefined) params.latitude = latitude;
    if (longitude !== undefined) params.longitude = longitude;

    const res = await apiClient.get<ApiResponse<WeatherDataDTO>>('/weather', { params });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to load weather forecast');
    }
    return res.data.data;
  },

  async getCenterWeather(centerId: string): Promise<WeatherDataDTO & { centerName: string; centerCode: string }> {
    const res = await apiClient.get<ApiResponse<WeatherDataDTO & { centerName: string; centerCode: string }>>(
      `/weather/center/${centerId}`
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to load center weather');
    }
    return res.data.data;
  },
};
