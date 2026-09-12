// ==============================================================================
// KisanFlow — Phase 3 Step 5: FarmerCrop API Automated Verification Suite
// Tests CROP-01 through CROP-32 strictly verifying RBAC, IDOR, Area Limits, Zod, and Auditing
// ==============================================================================

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  fn: () => Promise<{ passed: boolean; message: string }>;
}

let createdCropId: string | null = null;
let secondCropId: string | null = null;

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // CROP-01: Authenticated FARMER can list own crops
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-01',
    name: 'Authenticated FARMER can list own registered crops (200 OK)',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/farmer/crops`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const crops = res.data.data;
      if (!Array.isArray(crops)) {
        return { passed: false, message: 'Expected response data to be an array of farmer crops' };
      }

      return {
        passed: true,
        message: `Successfully listed ${crops.length} farmer crop(s)`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-02: Authenticated FARMER can create a crop cultivation on own farm
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-02',
    name: 'Authenticated FARMER can register a new crop on owned farm (201 Created)',
    fn: async () => {
      const payload = {
        farmId: 'farm-farmer-01',
        cropId: 'crop-wheat',
        season: 'RABI',
        sowingDate: '2025-11-15T00:00:00.000Z',
        expectedHarvestDate: '2026-04-10T00:00:00.000Z',
        cultivatedArea: 2.5,
        areaUnit: 'ACRE',
        expectedYield: 50.0,
        yieldUnit: 'QUINTAL',
        status: 'GROWING',
      };

      const res = await axios.post(`${API_BASE}/api/farmer/crops`, payload, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 201) {
        return { passed: false, message: `Expected status 201, got ${res.status}` };
      }

      const data = res.data.data;
      if (!data.id || data.farmId !== 'farm-farmer-01' || data.cropId !== 'crop-wheat') {
        return { passed: false, message: `Unexpected created crop data: ${JSON.stringify(data)}` };
      }

      createdCropId = data.id;

      // Verify contract fields
      const requiredFields = [
        'id',
        'farmerProfileId',
        'farmId',
        'cropId',
        'season',
        'sowingDate',
        'expectedHarvestDate',
        'cultivatedArea',
        'areaUnit',
        'expectedYield',
        'yieldUnit',
        'status',
        'createdAt',
        'updatedAt',
        'crop',
        'farm',
      ];

      for (const field of requiredFields) {
        if (!(field in data)) {
          return { passed: false, message: `Missing expected contract field: ${field}` };
        }
      }

      return {
        passed: true,
        message: `Crop registered successfully: ID=${data.id}, Crop=${data.crop.name}, Area=${data.cultivatedArea} ${data.areaUnit}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-03: Authenticated FARMER can retrieve single owned crop by ID
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-03',
    name: 'Authenticated FARMER can retrieve single owned crop by ID (200 OK)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No crop ID available from CROP-02' };
      }

      const res = await axios.get(`${API_BASE}/api/farmer/crops/${createdCropId}`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const crop = res.data.data;
      if (crop.id !== createdCropId || crop.farmId !== 'farm-farmer-01') {
        return { passed: false, message: `Mismatch in retrieved crop record: ${JSON.stringify(crop)}` };
      }

      return {
        passed: true,
        message: `Retrieved crop successfully: ${crop.id} (${crop.crop.name} on ${crop.farm.farmName})`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-04: Authenticated FARMER can update owned crop
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-04',
    name: 'Authenticated FARMER can update owned crop (200 OK)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No crop ID available from CROP-02' };
      }

      const updatePayload = {
        cultivatedArea: 3.0,
        expectedYield: 62.5,
        status: 'READY_FOR_HARVEST',
      };

      const res = await axios.put(`${API_BASE}/api/farmer/crops/${createdCropId}`, updatePayload, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const updated = res.data.data;
      if (updated.cultivatedArea !== 3.0 || updated.status !== 'READY_FOR_HARVEST') {
        return { passed: false, message: `Updated fields not reflected: ${JSON.stringify(updated)}` };
      }

      return {
        passed: true,
        message: `Crop updated successfully: area=${updated.cultivatedArea}, status=${updated.status}, yield=${updated.expectedYield}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-05: Authenticated FARMER can delete owned crop
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-05',
    name: 'Authenticated FARMER can delete owned crop (200 OK)',
    fn: async () => {
      // Create a temporary crop to delete so createdCropId remains for subsequent edge-case tests
      const tempRes = await axios.post(
        `${API_BASE}/api/farmer/crops`,
        {
          farmId: 'farm-farmer-01',
          cropId: 'crop-mustard',
          season: 'RABI',
          cultivatedArea: 1.0,
          areaUnit: 'ACRE',
          status: 'PLANNED',
        },
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      const tempId = tempRes.data.data.id;

      const delRes = await axios.delete(`${API_BASE}/api/farmer/crops/${tempId}`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (delRes.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${delRes.status}` };
      }

      // Verify deletion (should return 404 now)
      try {
        await axios.get(`${API_BASE}/api/farmer/crops/${tempId}`, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'Deleted crop was still retrievable via GET' };
      } catch (err: any) {
        if (err.response?.status !== 404) {
          return { passed: false, message: `Expected 404 after deletion, got ${err.response?.status}` };
        }
      }

      return {
        passed: true,
        message: `Crop record ${tempId} deleted and confirmed inaccessible`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-06: Unauthenticated GET /api/farmer/crops rejected with 401
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-06',
    name: 'Unauthenticated GET /api/farmer/crops is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/crops`);
        return { passed: false, message: 'Expected 401 UNAUTHORIZED, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 401) {
          return { passed: true, message: 'Unauthenticated GET rejected with 401 UNAUTHORIZED' };
        }
        return { passed: false, message: `Expected 401, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-07: Unauthenticated POST /api/farmer/crops rejected with 401
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-07',
    name: 'Unauthenticated POST /api/farmer/crops is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      try {
        await axios.post(`${API_BASE}/api/farmer/crops`, {
          farmId: 'farm-farmer-01',
          cropId: 'crop-wheat',
          season: 'RABI',
          cultivatedArea: 1.0,
        });
        return { passed: false, message: 'Expected 401 UNAUTHORIZED, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 401) {
          return { passed: true, message: 'Unauthenticated POST rejected with 401 UNAUTHORIZED' };
        }
        return { passed: false, message: `Expected 401, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-08: Unauthenticated PUT /api/farmer/crops/:id rejected with 401
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-08',
    name: 'Unauthenticated PUT /api/farmer/crops/:id is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      try {
        await axios.put(`${API_BASE}/api/farmer/crops/${createdCropId || 'any-id'}`, {
          cultivatedArea: 2.0,
        });
        return { passed: false, message: 'Expected 401 UNAUTHORIZED, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 401) {
          return { passed: true, message: 'Unauthenticated PUT rejected with 401 UNAUTHORIZED' };
        }
        return { passed: false, message: `Expected 401, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-09: Unauthenticated DELETE /api/farmer/crops/:id rejected with 401
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-09',
    name: 'Unauthenticated DELETE /api/farmer/crops/:id is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      try {
        await axios.delete(`${API_BASE}/api/farmer/crops/${createdCropId || 'any-id'}`);
        return { passed: false, message: 'Expected 401 UNAUTHORIZED, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 401) {
          return { passed: true, message: 'Unauthenticated DELETE rejected with 401 UNAUTHORIZED' };
        }
        return { passed: false, message: `Expected 401, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-10: Non-FARMER role (CENTER_OPERATOR) rejected with 403 FORBIDDEN
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-10',
    name: 'Center Operator cannot access farmer crop endpoints (403 FORBIDDEN)',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/crops`, {
          headers: { Authorization: 'Bearer demo-token-operator' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN, but operator request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 403) {
          return { passed: true, message: 'Operator correctly rejected with 403 FORBIDDEN' };
        }
        return { passed: false, message: `Expected 403, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-11: Non-FARMER role (QUALITY_INSPECTOR) rejected with 403 FORBIDDEN
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-11',
    name: 'Quality Inspector cannot access farmer crop endpoints (403 FORBIDDEN)',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/crops`, {
          headers: { Authorization: 'Bearer demo-token-inspector' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN, but inspector request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 403) {
          return { passed: true, message: 'Inspector correctly rejected with 403 FORBIDDEN' };
        }
        return { passed: false, message: `Expected 403, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-12: Non-FARMER role (GOVERNMENT_ADMIN) rejected with 403 FORBIDDEN
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-12',
    name: 'Government Admin cannot access farmer crop endpoints (403 FORBIDDEN)',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/crops`, {
          headers: { Authorization: 'Bearer demo-token-admin' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN, but admin request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 403) {
          return { passed: true, message: 'Admin correctly rejected with 403 FORBIDDEN' };
        }
        return { passed: false, message: `Expected 403, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-13: Non-FARMER role (SUPER_ADMIN) rejected with 403 FORBIDDEN
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-13',
    name: 'Super Admin cannot access farmer crop endpoints directly (403 FORBIDDEN)',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/crops`, {
          headers: { Authorization: 'Bearer demo-token-superadmin' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN, but superadmin request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 403) {
          return { passed: true, message: 'Superadmin correctly rejected with 403 FORBIDDEN' };
        }
        return { passed: false, message: `Expected 403, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-14: IDOR Prevention - Farmer cannot retrieve another farmer's crop
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-14',
    name: 'Farmer cannot access another farmer crop record (IDOR Prevention / 404 NOT_FOUND)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No created crop ID available' };
      }

      try {
        // Farmer 2 attempts to retrieve Farmer 1's crop
        await axios.get(`${API_BASE}/api/farmer/crops/${createdCropId}`, {
          headers: { Authorization: 'Bearer demo-token-farmer2' },
        });
        return { passed: false, message: 'Expected 404 NOT_FOUND on foreign crop ID, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            passed: true,
            message: 'Cross-farmer access prevented: returned 404 NOT_FOUND without leaking crop existence',
          };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-15: IDOR Prevention - Farmer cannot update another farmer's crop
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-15',
    name: 'Farmer cannot update another farmer crop record (IDOR Prevention / 404 NOT_FOUND)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No created crop ID available' };
      }

      try {
        // Farmer 2 attempts to update Farmer 1's crop
        await axios.put(
          `${API_BASE}/api/farmer/crops/${createdCropId}`,
          { cultivatedArea: 1.0 },
          { headers: { Authorization: 'Bearer demo-token-farmer2' } }
        );
        return { passed: false, message: 'Expected 404 NOT_FOUND, but update succeeded' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            passed: true,
            message: 'Cross-farmer update prevented with 404 NOT_FOUND',
          };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-16: IDOR Prevention - Farmer cannot delete another farmer's crop
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-16',
    name: 'Farmer cannot delete another farmer crop record (IDOR Prevention / 404 NOT_FOUND)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No created crop ID available' };
      }

      try {
        // Farmer 2 attempts to delete Farmer 1's crop
        await axios.delete(`${API_BASE}/api/farmer/crops/${createdCropId}`, {
          headers: { Authorization: 'Bearer demo-token-farmer2' },
        });
        return { passed: false, message: 'Expected 404 NOT_FOUND, but deletion succeeded' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            passed: true,
            message: 'Cross-farmer deletion prevented with 404 NOT_FOUND',
          };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-17: Farm Ownership - Cannot create crop on another farmer's farm
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-17',
    name: 'Farmer cannot register a crop on another farmer farm (404 NOT_FOUND)',
    fn: async () => {
      try {
        // Farmer 1 tries to plant on farm-farmer-02 (belongs to Farmer 2)
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-02',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 2.0,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 404 NOT_FOUND for unauthorized farm, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            passed: true,
            message: 'Planting on foreign farm rejected with 404 NOT_FOUND',
          };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-18: Farm Ownership - Cannot move crop to another farmer's farm on update
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-18',
    name: 'Farmer cannot update crop to assign it to another farmer farm (404 NOT_FOUND)',
    fn: async () => {
      if (!createdCropId) {
        return { passed: false, message: 'No created crop ID available' };
      }

      try {
        // Farmer 1 attempts to reassign their crop to Farmer 2's farm
        await axios.put(
          `${API_BASE}/api/farmer/crops/${createdCropId}`,
          { farmId: 'farm-farmer-02' },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 404 NOT_FOUND for foreign farm reassignment' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            passed: true,
            message: 'Reassignment to foreign farm rejected with 404 NOT_FOUND',
          };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-19: Non-existent farmId rejected with 404
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-19',
    name: 'Crop registration with non-existent farmId is rejected with 404 NOT_FOUND',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-nonexistent-999',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 1.5,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 404 for non-existent farmId' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return { passed: true, message: 'Non-existent farmId rejected with 404 NOT_FOUND' };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-20: Non-existent cropId rejected with 404 CROP_NOT_FOUND
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-20',
    name: 'Crop registration with non-existent cropId is rejected with 404 CROP_NOT_FOUND',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-invalid-xyz',
            season: 'RABI',
            cultivatedArea: 1.0,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 404 for invalid crop master' };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return { passed: true, message: 'Non-existent cropId rejected with 404 CROP_NOT_FOUND' };
        }
        return { passed: false, message: `Expected 404, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-21: Inactive cropId rejected with 400 INACTIVE_CROP
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-21',
    name: 'Crop registration with inactive crop master is rejected with 400 INACTIVE_CROP',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-inactive-demo',
            season: 'KHARIF',
            cultivatedArea: 1.0,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for inactive crop, but succeeded' };
      } catch (err: any) {
        if (err.response?.status === 400 && err.response?.data?.error?.code === 'INACTIVE_CROP') {
          return { passed: true, message: 'Inactive crop correctly rejected with 400 INACTIVE_CROP' };
        }
        return { passed: false, message: `Expected 400 INACTIVE_CROP, got ${err.response?.status} (${err.response?.data?.error?.code})` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-22: Single crop cultivatedArea exceeding total farm area rejected
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-22',
    name: 'Cultivated area exceeding farm capacity is rejected with 400 AREA_EXCEEDS_CAPACITY',
    fn: async () => {
      // Farm 1 total area is 6.5 acres; try to plant 10.0 acres
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 10.0,
            areaUnit: 'ACRE',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 AREA_EXCEEDS_CAPACITY, but request succeeded' };
      } catch (err: any) {
        if (err.response?.status === 400 && err.response?.data?.error?.code === 'AREA_EXCEEDS_CAPACITY') {
          return {
            passed: true,
            message: 'Single crop exceeding farm area rejected with 400 AREA_EXCEEDS_CAPACITY',
          };
        }
        return { passed: false, message: `Expected 400 AREA_EXCEEDS_CAPACITY, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-23: Cumulative active crops exceeding farm capacity rejected
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-23',
    name: 'Cumulative active crops exceeding farm capacity are rejected with 400 AREA_EXCEEDS_CAPACITY',
    fn: async () => {
      // Farm 1 has 6.5 acres total. createdCropId currently uses 3.0 acres.
      // Trying to plant another 4.0 acres (3.0 + 4.0 = 7.0 > 6.5) must fail.
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-paddy',
            season: 'KHARIF',
            cultivatedArea: 4.0,
            areaUnit: 'ACRE',
            status: 'PLANNED',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 AREA_EXCEEDS_CAPACITY for cumulative excess' };
      } catch (err: any) {
        if (err.response?.status === 400 && err.response?.data?.error?.code === 'AREA_EXCEEDS_CAPACITY') {
          return {
            passed: true,
            message: 'Cumulative acreage exceeding capacity correctly rejected with 400 AREA_EXCEEDS_CAPACITY',
          };
        }
        return { passed: false, message: `Expected 400 AREA_EXCEEDS_CAPACITY, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-24: Harvested crop area is freed and does not count towards active capacity
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-24',
    name: 'Harvested crop area is freed and does not count towards active capacity limit',
    fn: async () => {
      // Mark existing createdCropId as HARVESTED
      await axios.put(
        `${API_BASE}/api/farmer/crops/${createdCropId}`,
        { status: 'HARVESTED' },
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      // Now all 6.5 acres are free. Planting 5.0 acres should now succeed!
      const res = await axios.post(
        `${API_BASE}/api/farmer/crops`,
        {
          farmId: 'farm-farmer-01',
          cropId: 'crop-soybean',
          season: 'KHARIF',
          cultivatedArea: 5.0,
          areaUnit: 'ACRE',
          status: 'GROWING',
        },
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      if (res.status !== 201) {
        return { passed: false, message: `Expected 201 after harvest, got ${res.status}` };
      }

      secondCropId = res.data.data.id;

      return {
        passed: true,
        message: 'Harvested crop freed farm acreage: new crop of 5.0 acres registered successfully',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-25: Mass-assignment of farmerProfileId or userId rejected by strict schema
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-25',
    name: 'farmerProfileId and userId cannot be mass-assigned (400 VALIDATION_ERROR)',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 1.0,
            farmerProfileId: 'prof-farmer-02',
            userId: 'user-demo-farmer-02',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 VALIDATION_ERROR for mass-assignment' };
      } catch (err: any) {
        if (err.response?.status === 400) {
          return {
            passed: true,
            message: 'Injected identity parameters rejected with 400 VALIDATION_ERROR by strict Zod schema',
          };
        }
        return { passed: false, message: `Expected 400, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-26: Invalid cultivatedArea (zero, negative, excessive, > 2 decimals)
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-26',
    name: 'Invalid cultivatedArea rejected with 400 VALIDATION_ERROR (zero, negative, precision)',
    fn: async () => {
      const invalidValues = [0, -2.5, 10001, 1.234];

      for (const val of invalidValues) {
        try {
          await axios.post(
            `${API_BASE}/api/farmer/crops`,
            {
              farmId: 'farm-farmer-01',
              cropId: 'crop-wheat',
              season: 'RABI',
              cultivatedArea: val,
            },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return { passed: false, message: `Invalid cultivatedArea ${val} unexpectedly succeeded` };
        } catch (err: any) {
          if (err.response?.status !== 400) {
            return { passed: false, message: `Expected 400 for area ${val}, got ${err.response?.status}` };
          }
        }
      }

      return {
        passed: true,
        message: 'All invalid cultivated area values (0, negative, >10,000, >2 decimals) rejected with 400',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-27: Invalid crop season enum value rejected with 400
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-27',
    name: 'Invalid crop season enum rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-wheat',
            season: 'SPRING_MONSOON',
            cultivatedArea: 1.0,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for invalid season' };
      } catch (err: any) {
        if (err.response?.status === 400) {
          return { passed: true, message: 'Invalid season enum rejected with 400 VALIDATION_ERROR' };
        }
        return { passed: false, message: `Expected 400, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-28: Invalid crop status enum value rejected with 400
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-28',
    name: 'Invalid crop status enum rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 1.0,
            status: 'ROTTEN_DISCARDED',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for invalid status' };
      } catch (err: any) {
        if (err.response?.status === 400) {
          return { passed: true, message: 'Invalid status enum rejected with 400 VALIDATION_ERROR' };
        }
        return { passed: false, message: `Expected 400, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-29: Chronology violation (harvest date < sowing date) rejected with 400
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-29',
    name: 'Chronology violation (expectedHarvestDate earlier than sowingDate) rejected with 400',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/crops`,
          {
            farmId: 'farm-farmer-01',
            cropId: 'crop-wheat',
            season: 'RABI',
            cultivatedArea: 1.0,
            sowingDate: '2026-05-01T00:00:00.000Z',
            expectedHarvestDate: '2026-03-01T00:00:00.000Z', // 2 months before sowing!
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for harvest earlier than sowing' };
      } catch (err: any) {
        if (err.response?.status === 400) {
          return {
            passed: true,
            message: 'Chronology inversion rejected with 400 VALIDATION_ERROR',
          };
        }
        return { passed: false, message: `Expected 400, got ${err.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-30: Successful crop creation generates tamper-evident SHA-256 audit event
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-30',
    name: 'Successful crop creation generates tamper-evident SHA-256 audit event',
    fn: async () => {
      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'FarmerCrop',
          action: 'FARMER_CROP_CREATED',
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!auditEvent) {
        return { passed: false, message: 'No FARMER_CROP_CREATED audit event found in database' };
      }

      if (!auditEvent.currentHash || auditEvent.currentHash.length !== 64) {
        return { passed: false, message: `Invalid SHA-256 currentHash: ${auditEvent.currentHash}` };
      }

      if (!auditEvent.previousHash || auditEvent.previousHash.length !== 64) {
        return { passed: false, message: `Invalid previousHash: ${auditEvent.previousHash}` };
      }

      return {
        passed: true,
        message: `Audit event verified: seq=${auditEvent.sequenceNumber}, action=FARMER_CROP_CREATED, hash=${auditEvent.currentHash.slice(0, 16)}...`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-31: Successful crop update and deletion generate tamper-evident audit events
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-31',
    name: 'Successful crop update and deletion generate tamper-evident audit events',
    fn: async () => {
      const updateEvent = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'FarmerCrop',
          action: 'FARMER_CROP_UPDATED',
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!updateEvent) {
        return { passed: false, message: 'No FARMER_CROP_UPDATED audit event found' };
      }

      const deleteEvent = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'FarmerCrop',
          action: 'FARMER_CROP_DELETED',
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!deleteEvent) {
        return { passed: false, message: 'No FARMER_CROP_DELETED audit event found' };
      }

      return {
        passed: true,
        message: `Audit events verified: update(seq=${updateEvent.sequenceNumber}) and delete(seq=${deleteEvent.sequenceNumber})`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // CROP-32: SHA-256 cryptographic audit chain remains unbroken and verifiable
  // ----------------------------------------------------------------------------
  {
    id: 'CROP-32',
    name: 'Existing audit hash chain remains valid and unbroken after crop operations',
    fn: async () => {
      const events = await prisma.auditEvent.findMany({
        orderBy: { sequenceNumber: 'asc' },
        take: 50,
      });

      if (events.length < 2) {
        return { passed: false, message: `Insufficient audit events to verify chain (found ${events.length})` };
      }

      // Verify hash chaining integrity: block[i].previousHash === block[i-1].currentHash
      let validLinks = 0;
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];

        if (curr.previousHash !== prev.currentHash) {
          return {
            passed: false,
            message: `Broken audit chain at seq ${curr.sequenceNumber}: prevHash ${curr.previousHash} != ${prev.currentHash}`,
          };
        }
        validLinks++;
      }

      const latest = events[events.length - 1];
      return {
        passed: true,
        message: `Cryptographic hash chain validated across ${events.length} blocks (${validLinks} unbroken links verified, latest hash=${latest.currentHash.slice(0, 16)}...)`,
      };
    },
  },
];

async function runFarmerCropTests() {
  console.log('================================================================');
  console.log('🌾 KISANFLOW — PHASE 3 STEP 5: FARMERCROP API TEST RUNNER');
  console.log('================================================================');

  // Reset farmer crops to ensure test idempotency across repeated runs
  await prisma.farmerCrop.deleteMany({});

  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
    process.stdout.write(`▶ Running [${test.id}] ${test.name}...\n`);
    try {
      const result = await test.fn();
      if (result.passed) {
        passedCount++;
        console.log(`  \x1b[32mPASS\x1b[0m — ${result.message}`);
      } else {
        failedCount++;
        console.log(`  \x1b[31mFAIL\x1b[0m — ${result.message}`);
      }
    } catch (err: any) {
      failedCount++;
      const message = err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${JSON.stringify(err.response?.data || err.message)}`
        : err?.message || String(err);
      console.log(`  \x1b[31mERROR\x1b[0m — ${message}`);
    }
  }

  console.log('================================================================');
  console.log(
    `TEST SUMMARY: Total: ${tests.length} | Passed: ${passedCount} | Failed: ${failedCount}`
  );
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFarmerCropTests().catch((err) => {
  console.error('Fatal error running FarmerCrop tests:', err);
  process.exit(1);
});
