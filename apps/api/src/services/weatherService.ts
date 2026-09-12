// ==============================================================================
// KisanFlow — Weather Service
// Orchestrates Weather provider, handles coordinate validation and center lookups.
// ==============================================================================

import { WeatherDataDTO, ProviderIntegrationItem } from '@kisanflow/types';
import { IWeatherProvider, defaultWeatherProvider } from '../providers/weatherProvider.ts';
import { prisma } from '../config/prisma.ts';

export class WeatherService {
  private provider: IWeatherProvider;

  constructor(provider: IWeatherProvider = defaultWeatherProvider) {
    this.provider = provider;
  }

  /**
   * Fetch weather forecast by explicit coordinates
   */
  public async getWeatherByCoordinates(latitude: number, longitude: number): Promise<WeatherDataDTO> {
    return this.provider.getWeather(latitude, longitude);
  }

  /**
   * Fetch weather forecast for a registered Procurement Center
   */
  public async getWeatherForCenter(centerId: string): Promise<WeatherDataDTO & { centerName: string; centerCode: string }> {
    const center = await prisma.procurementCenter.findUnique({
      where: { id: centerId },
    });

    if (!center) {
      const err: any = new Error(`Procurement Center with ID ${centerId} was not found`);
      err.statusCode = 404;
      err.code = 'CENTER_NOT_FOUND';
      throw err;
    }

    const lat = Number(center.latitude);
    const lon = Number(center.longitude);

    const weather = await this.provider.getWeather(lat, lon);

    return {
      ...weather,
      centerName: center.name,
      centerCode: center.code,
    };
  }

  /**
   * Get provider metadata and health status
   */
  public getProviderStatus(): ProviderIntegrationItem {
    return {
      name: 'Weather Forecasting',
      serviceType: 'Meteorological & Moisture Advisory',
      status: 'REAL',
      provider: 'Open-Meteo (Free Open API)',
      requiresApiKey: false,
      isConfigured: true,
      endpointUrl: 'https://api.open-meteo.com/v1/forecast',
      description: 'Live real-time weather & 7-day forecast for agricultural procurement centers without API key friction.',
    };
  }
}

export const defaultWeatherService = new WeatherService();
