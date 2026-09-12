// ==============================================================================
// KisanFlow — Mandi Data Provider & data.gov.in Implementation
// Replaces external eNAM API with Government Open Data (data.gov.in).
// Includes seed mandi benchmarks with honest simulation/fallback indicators.
// ==============================================================================

import { MandiPrice, MandiPriceResponseDTO } from '@kisanflow/types';
import { env } from '../config/env.ts';

export interface IMandiDataProvider {
  name: string;
  getMandiPrices(filters?: {
    commodity?: string;
    state?: string;
    district?: string;
    market?: string;
    limit?: number;
  }): Promise<MandiPriceResponseDTO>;
  isConfigured(): boolean;
}

/**
 * Authentic baseline Indian agricultural mandi benchmark data (APMC markets)
 * Used as honest local fallback when data.gov.in API key or dataset is not configured.
 */
export const SEED_MANDI_PRICES: MandiPrice[] = [
  {
    state: 'Haryana',
    district: 'Karnal',
    market: 'Karnal Grain Mandi',
    commodity: 'Wheat',
    variety: 'HD-2967',
    arrivalDate: '2026-04-10',
    minPrice: 2275,
    maxPrice: 2420,
    modalPrice: 2350,
  },
  {
    state: 'Punjab',
    district: 'Ludhiana',
    market: 'Khanna Mandi Yard',
    commodity: 'Wheat',
    variety: 'PBW-343',
    arrivalDate: '2026-04-11',
    minPrice: 2275,
    maxPrice: 2450,
    modalPrice: 2375,
  },
  {
    state: 'Punjab',
    district: 'Ludhiana',
    market: 'Ludhiana Integrated Mandi Facility',
    commodity: 'Paddy (Dhan)',
    variety: 'Basmati 1121',
    arrivalDate: '2026-04-10',
    minPrice: 3400,
    maxPrice: 3850,
    modalPrice: 3650,
  },
  {
    state: 'Madhya Pradesh',
    district: 'Indore',
    market: 'Chhavani Grain Market',
    commodity: 'Soyabean',
    variety: 'Yellow JS 335',
    arrivalDate: '2026-04-09',
    minPrice: 4600,
    maxPrice: 5100,
    modalPrice: 4892,
  },
  {
    state: 'Maharashtra',
    district: 'Nagpur',
    market: 'Kalamna Market Yard',
    commodity: 'Cotton',
    variety: 'Medium Staple',
    arrivalDate: '2026-04-08',
    minPrice: 6900,
    maxPrice: 7450,
    modalPrice: 7121,
  },
  {
    state: 'Rajasthan',
    district: 'Jaipur',
    market: 'Jaipur Shekhawati Mandi Center',
    commodity: 'Mustard',
    variety: 'Pusa Bold',
    arrivalDate: '2026-04-11',
    minPrice: 5450,
    maxPrice: 5900,
    modalPrice: 5650,
  },
  {
    state: 'Uttar Pradesh',
    district: 'Aligarh',
    market: 'Aligarh Mandi Yard',
    commodity: 'Wheat',
    variety: 'Lokwan',
    arrivalDate: '2026-04-10',
    minPrice: 2250,
    maxPrice: 2380,
    modalPrice: 2320,
  },
  {
    state: 'Gujarat',
    district: 'Rajkot',
    market: 'Rajkot APMC',
    commodity: 'Groundnut',
    variety: 'Bold G-20',
    arrivalDate: '2026-04-09',
    minPrice: 6100,
    maxPrice: 6750,
    modalPrice: 6378,
  },
];

export class DataGovMandiProvider implements IMandiDataProvider {
  public name = 'data.gov.in';
  private apiUrl: string;
  private apiKey?: string;
  private resourceId?: string;

  constructor(
    apiUrl: string = env.DATA_GOV_API_URL,
    apiKey?: string,
    resourceId?: string
  ) {
    this.apiUrl = apiUrl || 'https://api.data.gov.in';
    this.apiKey = apiKey || env.DATA_GOV_API_KEY;
    this.resourceId = resourceId || env.DATA_GOV_MANDI_RESOURCE_ID;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.resourceId && this.resourceId.trim().length > 0);
  }

  public async getMandiPrices(filters?: {
    commodity?: string;
    state?: string;
    district?: string;
    market?: string;
    limit?: number;
  }): Promise<MandiPriceResponseDTO> {
    // If real data.gov.in credentials are not configured, use local fallback seed data
    // Clearly marked as NOT_CONFIGURED and isSimulated: true
    if (!this.isConfigured()) {
      return this.filterFallbackPrices(filters);
    }

    try {
      const url = new URL(`${this.apiUrl}/resource/${this.resourceId}`);
      url.searchParams.set('api-key', this.apiKey!);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(filters?.limit || 50));

      if (filters?.commodity) {
        url.searchParams.set('filters[commodity]', filters.commodity);
      }
      if (filters?.state) {
        url.searchParams.set('filters[state]', filters.state);
      }
      if (filters?.district) {
        url.searchParams.set('filters[district]', filters.district);
      }
      if (filters?.market) {
        url.searchParams.set('filters[market]', filters.market);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KisanFlow/1.0 (Agricultural Procurement Platform)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`data.gov.in API returned HTTP ${response.status}. Using fallback seed prices.`);
        return this.filterFallbackPrices(filters, 'UNAVAILABLE');
      }

      const json = await response.json() as any;
      const records: any[] = json?.records || [];

      // Normalize records into stable MandiPrice interface
      const normalized: MandiPrice[] = records.map((r) => ({
        state: String(r.state || r.State || 'Unknown'),
        district: String(r.district || r.District || 'Unknown'),
        market: String(r.market || r.Market || 'Unknown'),
        commodity: String(r.commodity || r.Commodity || 'Unknown'),
        variety: r.variety || r.Variety ? String(r.variety || r.Variety) : undefined,
        arrivalDate: r.arrival_date || r.Arrival_Date ? String(r.arrival_date || r.Arrival_Date) : undefined,
        minPrice: r.min_price || r.Min_Price ? Number(r.min_price || r.Min_Price) : undefined,
        maxPrice: r.max_price || r.Max_Price ? Number(r.max_price || r.Max_Price) : undefined,
        modalPrice: r.modal_price || r.Modal_Price ? Number(r.modal_price || r.Modal_Price) : undefined,
      }));

      return {
        source: 'DATA_GOV_IN',
        isSimulated: false,
        providerStatus: 'REAL',
        totalRecords: normalized.length,
        records: normalized,
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('⚠️ Error calling data.gov.in API, using fallback:', err);
      return this.filterFallbackPrices(filters, 'UNAVAILABLE');
    }
  }

  private filterFallbackPrices(
    filters?: {
      commodity?: string;
      state?: string;
      district?: string;
      market?: string;
      limit?: number;
    },
    status: 'NOT_CONFIGURED' | 'MOCK' | 'UNAVAILABLE' = 'NOT_CONFIGURED'
  ): MandiPriceResponseDTO {
    let list = [...SEED_MANDI_PRICES];

    if (filters?.commodity) {
      const q = filters.commodity.toLowerCase();
      list = list.filter((p) => p.commodity.toLowerCase().includes(q));
    }
    if (filters?.state) {
      const q = filters.state.toLowerCase();
      list = list.filter((p) => p.state.toLowerCase().includes(q));
    }
    if (filters?.district) {
      const q = filters.district.toLowerCase();
      list = list.filter((p) => p.district.toLowerCase().includes(q));
    }
    if (filters?.market) {
      const q = filters.market.toLowerCase();
      list = list.filter((p) => p.market.toLowerCase().includes(q));
    }

    const limit = filters?.limit || 20;
    const records = list.slice(0, limit);

    return {
      source: 'DEMO_MANDI_FALLBACK',
      isSimulated: true,
      providerStatus: status,
      totalRecords: records.length,
      records,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const defaultMandiDataProvider = new DataGovMandiProvider();
