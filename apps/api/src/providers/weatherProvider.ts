// ==============================================================================
// KisanFlow — Weather Provider Abstraction & Open-Meteo Implementation
// Replaces external IMD integration with free, non-API-key Open-Meteo service.
// ==============================================================================

import { WeatherDataDTO, WeatherCurrentDTO, WeatherDailyForecastDTO } from '@kisanflow/types';
import { env } from '../config/env.ts';

export interface IWeatherProvider {
  name: string;
  getWeather(latitude: number, longitude: number): Promise<WeatherDataDTO>;
  isConfigured(): boolean;
}

/**
 * WMO Weather interpretation codes (WW) to human-readable conditions
 */
export function mapWMOCodeToCondition(code: number): string {
  switch (code) {
    case 0:
      return 'Clear sky';
    case 1:
      return 'Mainly clear';
    case 2:
      return 'Partly cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Fog';
    case 51:
    case 53:
    case 55:
      return 'Drizzle';
    case 56:
    case 57:
      return 'Freezing Drizzle';
    case 61:
    case 63:
    case 65:
      return 'Rain';
    case 66:
    case 67:
      return 'Freezing Rain';
    case 71:
    case 73:
    case 75:
      return 'Snow fall';
    case 77:
      return 'Snow grains';
    case 80:
    case 81:
    case 82:
      return 'Rain showers';
    case 85:
    case 86:
      return 'Snow showers';
    case 95:
      return 'Thunderstorm';
    case 96:
    case 99:
      return 'Thunderstorm with slight or heavy hail';
    default:
      return 'Moderate weather';
  }
}

/**
 * Open-Meteo Provider Implementation
 * Open-Meteo offers free weather forecasting with no API key requirement.
 */
export class OpenMeteoProvider implements IWeatherProvider {
  public name = 'open-meteo';
  private apiUrl: string;
  private timeoutMs: number;

  constructor(apiUrl: string = env.WEATHER_API_URL, timeoutMs: number = 6000) {
    this.apiUrl = apiUrl || 'https://api.open-meteo.com/v1/forecast';
    this.timeoutMs = timeoutMs;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiUrl);
  }

  public async getWeather(latitude: number, longitude: number): Promise<WeatherDataDTO> {
    // 1. Validate coordinates
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      throw new Error(`Invalid coordinates: latitude and longitude must be valid numbers (got lat: ${latitude}, lon: ${longitude})`);
    }

    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
    }

    // 2. Fetch from Open-Meteo with AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const queryUrl = new URL(this.apiUrl);
    queryUrl.searchParams.set('latitude', latitude.toFixed(4));
    queryUrl.searchParams.set('longitude', longitude.toFixed(4));
    queryUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m'
    );
    queryUrl.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max'
    );
    queryUrl.searchParams.set('timezone', 'auto');

    try {
      const response = await fetch(queryUrl.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KisanFlow/1.0 (Agricultural Procurement Platform)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP error: status ${response.status} ${response.statusText}`);
      }

      const raw = await response.json() as any;

      if (!raw || !raw.current) {
        throw new Error('Malformed response received from Open-Meteo: missing current weather payload');
      }

      const weatherCode = Number(raw.current.weather_code ?? 0);
      const condition = mapWMOCodeToCondition(weatherCode);

      const current: WeatherCurrentDTO = {
        temperature: Number(raw.current.temperature_2m ?? 25),
        apparentTemperature: Number(raw.current.apparent_temperature ?? 26),
        relativeHumidity: Number(raw.current.relative_humidity_2m ?? 50),
        precipitation: Number(raw.current.precipitation ?? 0),
        rainfall: Number(raw.current.rain ?? 0),
        windSpeed: Number(raw.current.wind_speed_10m ?? 8),
        weatherCode,
        condition,
        isDay: raw.current.is_day !== undefined ? Boolean(raw.current.is_day) : true,
      };

      const dailyForecast: WeatherDailyForecastDTO[] = [];
      if (raw.daily && Array.isArray(raw.daily.time)) {
        for (let i = 0; i < Math.min(raw.daily.time.length, 7); i++) {
          const dayCode = Number(raw.daily.weather_code?.[i] ?? 0);
          dailyForecast.push({
            date: String(raw.daily.time[i]),
            weatherCode: dayCode,
            condition: mapWMOCodeToCondition(dayCode),
            temperatureMax: Number(raw.daily.temperature_2m_max?.[i] ?? 30),
            temperatureMin: Number(raw.daily.temperature_2m_min?.[i] ?? 20),
            precipitationSum: Number(raw.daily.precipitation_sum?.[i] ?? 0),
            precipitationProbabilityMax: Number(raw.daily.precipitation_probability_max?.[i] ?? 0),
          });
        }
      }

      return {
        latitude: Number(raw.latitude ?? latitude),
        longitude: Number(raw.longitude ?? longitude),
        timezone: String(raw.timezone ?? 'Asia/Kolkata'),
        elevation: raw.elevation !== undefined ? Number(raw.elevation) : undefined,
        provider: 'open-meteo',
        isFallback: false,
        current,
        dailyForecast,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      // Graceful fallback rather than crashing
      return this.generateFallbackWeather(latitude, longitude, err?.message ?? 'Network error');
    }
  }

  /**
   * Deterministic agricultural fallback weather in case Open-Meteo is temporarily unreachable
   */
  public generateFallbackWeather(latitude: number, longitude: number, reason: string): WeatherDataDTO {
    // Produce realistic seasonal temperature based on latitude
    const approxTemp = Math.round(24 + Math.sin(latitude) * 5);
    const today = new Date().toISOString().split('T')[0];

    const current: WeatherCurrentDTO = {
      temperature: approxTemp,
      apparentTemperature: approxTemp + 1,
      relativeHumidity: 55,
      precipitation: 0,
      rainfall: 0,
      windSpeed: 10,
      weatherCode: 1,
      condition: 'Mainly clear (Offline estimate)',
      isDay: true,
    };

    const dailyForecast: WeatherDailyForecastDTO[] = [0, 1, 2, 3, 4].map((offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return {
        date: d.toISOString().split('T')[0],
        weatherCode: 1,
        condition: 'Mainly clear',
        temperatureMax: approxTemp + 4,
        temperatureMin: approxTemp - 4,
        precipitationSum: 0,
        precipitationProbabilityMax: 10,
      };
    });

    return {
      latitude,
      longitude,
      timezone: 'Asia/Kolkata',
      elevation: 240,
      provider: 'fallback',
      isFallback: true,
      current,
      dailyForecast,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const defaultWeatherProvider = new OpenMeteoProvider();
