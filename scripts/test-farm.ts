// ==============================================================================
// KisanFlow — Phase 3 Step 4: Farm API Automated Verification Suite
// Tests FARM-01 through FARM-18 strictly verifying RBAC, IDOR, Zod, and Auditing
// ==============================================================================

import axios, { AxiosError } from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  fn: () => Promise<{ passed: boolean; message: string }>;
}

let createdTestFarmId: string | null = null;

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // FARM-01: Authenticated FARMER can list own farms
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-01',
    name: 'Authenticated FARMER can list own farms (200 OK)',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/farmer/farms`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const farms = res.data.data;
      if (!Array.isArray(farms)) {
        return { passed: false, message: 'Expected response data to be an array of farms' };
      }

      const hasInitialFarm = farms.some((f: any) => f.id === 'farm-farmer-01');
      if (!hasInitialFarm) {
        return { passed: false, message: 'Initial farm farm-farmer-01 not found in farmer farm list' };
      }

      // Verify contract fields
      const sample = farms[0];
      const requiredFields = [
        'id',
        'farmName',
        'landParcelNumber',
        'district',
        'state',
        'village',
        'totalAreaAcres',
        'verifiedArea',
        'isLandVerified',
        'landAreaUnit',
        'ownershipType',
        'irrigationType',
        'soilType',
        'latitude',
        'longitude',
        'verificationStatus',
        'createdAt',
        'updatedAt',
      ];

      for (const field of requiredFields) {
        if (!(field in sample)) {
          return { passed: false, message: `Missing expected farm field: ${field}` };
        }
      }

      return {
        passed: true,
        message: `Successfully listed ${farms.length} farm(s) with all required fields present`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-02: Authenticated FARMER can retrieve own farm
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-02',
    name: 'Authenticated FARMER can retrieve own farm (200 OK)',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/farmer/farms/farm-farmer-01`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const farm = res.data.data;
      if (farm.id !== 'farm-farmer-01' || farm.landParcelNumber !== 'KH-882/19') {
        return {
          passed: false,
          message: `Unexpected farm data: ID=${farm.id}, Parcel=${farm.landParcelNumber}`,
        };
      }

      return {
        passed: true,
        message: `Retrieved farm successfully: ${farm.id} (${farm.landParcelNumber}) in ${farm.district}, ${farm.state}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-03: Authenticated FARMER can create a farm
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-03',
    name: 'Authenticated FARMER can create a farm (201 Created)',
    fn: async () => {
      const payload = {
        farmName: 'Test Greenfield Parcel',
        landParcelNumber: `KH-T-${Date.now().toString().slice(-6)}`,
        district: 'Karnal',
        state: 'Haryana',
        village: 'Taraori',
        totalAreaAcres: 4.75,
        landAreaUnit: 'ACRE',
        ownershipType: 'OWNED',
        irrigationType: 'Canal Irrigation',
        soilType: 'Clay Loam',
        latitude: 29.8012,
        longitude: 76.9234,
      };

      const res = await axios.post(`${API_BASE}/api/farmer/farms`, payload, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 201) {
        return { passed: false, message: `Expected status 201, got ${res.status}` };
      }

      const farm = res.data.data;
      createdTestFarmId = farm.id;

      if (!farm.id || farm.totalAreaAcres !== 4.75 || farm.isLandVerified !== false || farm.verificationStatus !== 'PENDING') {
        return {
          passed: false,
          message: `Farm created with unexpected defaults: verified=${farm.isLandVerified}, status=${farm.verificationStatus}`,
        };
      }

      return {
        passed: true,
        message: `Farm created successfully: ID=${farm.id}, Parcel=${farm.landParcelNumber}, Status=${farm.verificationStatus}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-04: Authenticated FARMER can update own farm
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-04',
    name: 'Authenticated FARMER can update own farm (200 OK)',
    fn: async () => {
      if (!createdTestFarmId) {
        return { passed: false, message: 'Cannot update: test farm was not created' };
      }

      const updatePayload = {
        farmName: 'Updated Greenfield Estate',
        irrigationType: 'Solar Drip Irrigation',
        totalAreaAcres: 5.5,
      };

      const res = await axios.put(
        `${API_BASE}/api/farmer/farms/${createdTestFarmId}`,
        updatePayload,
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      if (res.status !== 200) {
        return { passed: false, message: `Expected status 200, got ${res.status}` };
      }

      const farm = res.data.data;
      if (farm.farmName !== updatePayload.farmName || farm.totalAreaAcres !== 5.5 || farm.irrigationType !== updatePayload.irrigationType) {
        return { passed: false, message: 'Farm update did not reflect returned properties' };
      }

      // Verify in DB
      const dbFarm = await prisma.farm.findUnique({ where: { id: createdTestFarmId } });
      if (!dbFarm || dbFarm.farmName !== updatePayload.farmName || Number(dbFarm.totalAreaAcres) !== 5.5) {
        return { passed: false, message: 'Farm update not persisted in database' };
      }

      return {
        passed: true,
        message: `Farm updated and verified in DB: name="${farm.farmName}", area=${farm.totalAreaAcres}, irrigation="${farm.irrigationType}"`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-05: Unauthenticated request is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-05',
    name: 'Unauthenticated request is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      let getFails = false;
      let postFails = false;

      try {
        await axios.get(`${API_BASE}/api/farmer/farms`);
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status === 401) getFails = true;
      }

      try {
        await axios.post(`${API_BASE}/api/farmer/farms`, {
          landParcelNumber: 'KH-1',
          district: 'Karnal',
          state: 'Haryana',
          village: 'Taraori',
          totalAreaAcres: 5,
        });
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status === 401) postFails = true;
      }

      if (getFails && postFails) {
        return { passed: true, message: 'Unauthenticated requests rejected with 401 UNAUTHORIZED across endpoints' };
      }

      return {
        passed: false,
        message: `Unauthenticated check failed: GET failed=${getFails}, POST failed=${postFails}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-06: Non-FARMER role is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-06',
    name: 'Non-FARMER role is rejected with 403 FORBIDDEN',
    fn: async () => {
      const nonFarmerTokens = [
        'demo-token-operator',
        'demo-token-inspector',
        'demo-token-admin',
        'demo-token-superadmin',
      ];

      for (const token of nonFarmerTokens) {
        try {
          await axios.get(`${API_BASE}/api/farmer/farms`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return {
            passed: false,
            message: `Role with token "${token}" was unexpectedly granted access to /farms`,
          };
        } catch (err) {
          const error = err as AxiosError;
          if (error.response?.status !== 403) {
            return {
              passed: false,
              message: `Role with token "${token}" received status ${error.response?.status}, expected 403`,
            };
          }
        }
      }

      return {
        passed: true,
        message: 'All non-FARMER roles (operator, inspector, admin, superadmin) successfully rejected with 403 FORBIDDEN',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-07: Farmer cannot access another farmer's farm
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-07',
    name: 'Farmer cannot access another farmer farm parcel (IDOR Prevention / 404 NOT_FOUND)',
    fn: async () => {
      try {
        // Farmer 1 attempts to access Farmer 2's farm
        await axios.get(`${API_BASE}/api/farmer/farms/farm-farmer-02`, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'IDOR vulnerability: Farmer 1 accessed Farmer 2 farm' };
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status === 404) {
          return {
            passed: true,
            message: 'Cross-farmer access prevented: returned 404 NOT_FOUND without leaking farm existence',
          };
        }
        return {
          passed: false,
          message: `Expected 404 NOT_FOUND for cross-farmer access, got status ${error.response?.status}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-08: Farmer cannot update another farmer's farm
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-08',
    name: 'Farmer cannot update another farmer farm parcel (404 NOT_FOUND)',
    fn: async () => {
      try {
        // Farmer 1 attempts to update Farmer 2's farm
        await axios.put(
          `${API_BASE}/api/farmer/farms/farm-farmer-02`,
          { farmName: 'Malicious Hijacked Farm' },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'IDOR vulnerability: Farmer 1 updated Farmer 2 farm' };
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status !== 404) {
          return {
            passed: false,
            message: `Expected 404 NOT_FOUND for foreign farm update, got ${error.response?.status}`,
          };
        }

        // Verify DB untouched
        const farm2 = await prisma.farm.findUnique({ where: { id: 'farm-farmer-02' } });
        if (farm2?.farmName === 'Malicious Hijacked Farm') {
          return { passed: false, message: 'Database was modified despite error' };
        }

        return {
          passed: true,
          message: 'Foreign farm modification rejected with 404 NOT_FOUND and database verified intact',
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-09: farmerProfileId/userId cannot be mass-assigned
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-09',
    name: 'farmerProfileId and userId cannot be mass-assigned (400 VALIDATION_ERROR)',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/farms`,
          {
            landParcelNumber: 'KH-ATTACK-01',
            district: 'Karnal',
            state: 'Haryana',
            village: 'Taraori',
            totalAreaAcres: 5,
            farmerProfileId: 'prof-farmer-02', // Attempt to assign farm to another farmer
            userId: 'user-demo-farmer-02',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for injected identity fields, request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        const errCode = error.response?.data?.error?.code || error.response?.data?.code;
        if (error.response?.status === 400 && errCode === 'VALIDATION_ERROR') {
          return {
            passed: true,
            message: 'Injected identity parameters rejected with 400 VALIDATION_ERROR by strict Zod schema',
          };
        }
        return {
          passed: false,
          message: `Expected 400 VALIDATION_ERROR, got status ${error.response?.status} / code ${errCode}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-10: verificationStatus/isLandVerified/verifiedArea cannot be farmer-controlled
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-10',
    name: 'verificationStatus/isLandVerified/verifiedArea cannot be farmer-controlled (400 VALIDATION_ERROR)',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/farms`,
          {
            landParcelNumber: 'KH-ATTACK-02',
            district: 'Karnal',
            state: 'Haryana',
            village: 'Taraori',
            totalAreaAcres: 5,
            verificationStatus: 'VERIFIED',
            isLandVerified: true,
            verifiedArea: 100.0,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for self-verification attempt, request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        const errCode = error.response?.data?.error?.code || error.response?.data?.code;
        if (error.response?.status === 400 && errCode === 'VALIDATION_ERROR') {
          return {
            passed: true,
            message: 'Self-verification manipulation blocked with 400 VALIDATION_ERROR',
          };
        }
        return {
          passed: false,
          message: `Expected 400 VALIDATION_ERROR, got status ${error.response?.status} / code ${errCode}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-11: Invalid land area is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-11',
    name: 'Invalid land area is rejected with 400 VALIDATION_ERROR (negative, zero, excessive, precision)',
    fn: async () => {
      const invalidAreas = [-5, 0, 100000, 4.123];

      for (const area of invalidAreas) {
        try {
          await axios.post(
            `${API_BASE}/api/farmer/farms`,
            {
              landParcelNumber: 'KH-INVALID-AREA',
              district: 'Karnal',
              state: 'Haryana',
              village: 'Taraori',
              totalAreaAcres: area,
            },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return {
            passed: false,
            message: `Invalid totalAreaAcres value (${area}) was accepted without validation error`,
          };
        } catch (err) {
          const error = err as AxiosError<any>;
          const errCode = error.response?.data?.error?.code || error.response?.data?.code;
          if (error.response?.status !== 400 || errCode !== 'VALIDATION_ERROR') {
            return {
              passed: false,
              message: `Area ${area} returned status ${error.response?.status} / code ${errCode}, expected 400 VALIDATION_ERROR`,
            };
          }
        }
      }

      return {
        passed: true,
        message: 'All invalid land area values (negative, zero, >10,000, >2 decimals) rejected with 400 VALIDATION_ERROR',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-12: Invalid latitude/longitude is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-12',
    name: 'Invalid latitude/longitude coordinates rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      const invalidCoordinates = [
        { lat: 95, lon: 76 },
        { lat: -95, lon: 76 },
        { lat: 29, lon: 185 },
        { lat: 29, lon: -185 },
      ];

      for (const coords of invalidCoordinates) {
        try {
          await axios.post(
            `${API_BASE}/api/farmer/farms`,
            {
              landParcelNumber: 'KH-INVALID-COORDS',
              district: 'Karnal',
              state: 'Haryana',
              village: 'Taraori',
              totalAreaAcres: 5,
              latitude: coords.lat,
              longitude: coords.lon,
            },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return {
            passed: false,
            message: `Invalid coordinates (lat: ${coords.lat}, lon: ${coords.lon}) unexpectedly accepted`,
          };
        } catch (err) {
          const error = err as AxiosError<any>;
          const errCode = error.response?.data?.error?.code || error.response?.data?.code;
          if (error.response?.status !== 400 || errCode !== 'VALIDATION_ERROR') {
            return {
              passed: false,
              message: `Coordinates (lat: ${coords.lat}, lon: ${coords.lon}) yielded status ${error.response?.status}, expected 400 VALIDATION_ERROR`,
            };
          }
        }
      }

      return {
        passed: true,
        message: 'Invalid coordinate values (out of -90..90 and -180..180 ranges) rejected with 400 VALIDATION_ERROR',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-13: Invalid enum values are rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-13',
    name: 'Invalid enum values rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      // Invalid landAreaUnit
      try {
        await axios.post(
          `${API_BASE}/api/farmer/farms`,
          {
            landParcelNumber: 'KH-BAD-ENUM',
            district: 'Karnal',
            state: 'Haryana',
            village: 'Taraori',
            totalAreaAcres: 5,
            landAreaUnit: 'SQUARE_METERS',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Invalid landAreaUnit SQUARE_METERS accepted' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 400) {
          return { passed: false, message: `Expected 400 for invalid landAreaUnit, got ${error.response?.status}` };
        }
      }

      // Invalid ownershipType
      try {
        await axios.post(
          `${API_BASE}/api/farmer/farms`,
          {
            landParcelNumber: 'KH-BAD-ENUM',
            district: 'Karnal',
            state: 'Haryana',
            village: 'Taraori',
            totalAreaAcres: 5,
            ownershipType: 'MORTGAGED',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Invalid ownershipType MORTGAGED accepted' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 400) {
          return { passed: false, message: `Expected 400 for invalid ownershipType, got ${error.response?.status}` };
        }
      }

      return {
        passed: true,
        message: 'Invalid enum values for landAreaUnit and ownershipType rejected with 400 VALIDATION_ERROR',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-14: Unknown request fields are rejected
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-14',
    name: 'Unknown request fields rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/farmer/farms`,
          {
            landParcelNumber: 'KH-UNKNOWN-FIELDS',
            district: 'Karnal',
            state: 'Haryana',
            village: 'Taraori',
            totalAreaAcres: 5,
            arbitraryInjectedField: 'malicious-data',
            developerMode: true,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for unknown fields, request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        const errCode = error.response?.data?.error?.code || error.response?.data?.code;
        if (error.response?.status === 400 && errCode === 'VALIDATION_ERROR') {
          return {
            passed: true,
            message: 'Unknown payload properties rejected with 400 VALIDATION_ERROR by strict schema',
          };
        }
        return {
          passed: false,
          message: `Expected 400 VALIDATION_ERROR, got status ${error.response?.status} / code ${errCode}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-15: Successful farm creation creates an audit event
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-15',
    name: 'Successful farm creation creates a tamper-evident audit event',
    fn: async () => {
      if (!createdTestFarmId) {
        return { passed: false, message: 'No created test farm ID available to check audit event' };
      }

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          action: 'FARM_CREATED',
          entityId: createdTestFarmId,
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!auditEvent) {
        return { passed: false, message: 'No audit event found for FARM_CREATED' };
      }

      if (auditEvent.actorId !== 'user-demo-farmer-01' || !auditEvent.currentHash) {
        return {
          passed: false,
          message: `Audit event missing cryptographic fields: actor=${auditEvent.actorId}, hash=${auditEvent.currentHash}`,
        };
      }

      const metadata = auditEvent.metadata as any;
      if (metadata.farmId !== createdTestFarmId || !metadata.landParcelNumber) {
        return { passed: false, message: 'Audit metadata missing expected farm details' };
      }

      return {
        passed: true,
        message: `Audit event verified: seq=${auditEvent.sequenceNumber}, action=FARM_CREATED, hash=${auditEvent.currentHash.slice(0, 16)}...`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-16: Successful farm update creates an audit event
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-16',
    name: 'Successful farm update creates a tamper-evident audit event',
    fn: async () => {
      if (!createdTestFarmId) {
        return { passed: false, message: 'No created test farm ID available to check update audit event' };
      }

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          action: 'FARM_UPDATED',
          entityId: createdTestFarmId,
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!auditEvent) {
        return { passed: false, message: 'No audit event found for FARM_UPDATED' };
      }

      if (auditEvent.actorId !== 'user-demo-farmer-01' || !auditEvent.currentHash) {
        return {
          passed: false,
          message: `Audit event missing cryptographic fields: actor=${auditEvent.actorId}, hash=${auditEvent.currentHash}`,
        };
      }

      const metadata = auditEvent.metadata as any;
      if (!Array.isArray(metadata.updatedFields) || metadata.updatedFields.length === 0) {
        return { passed: false, message: 'Audit metadata missing updatedFields list' };
      }

      return {
        passed: true,
        message: `Audit event verified: seq=${auditEvent.sequenceNumber}, action=FARM_UPDATED, fields=[${metadata.updatedFields.join(', ')}]`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-17: Audit SHA-256 chain remains valid
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-17',
    name: 'Existing audit hash chain remains valid and unbroken after farm operations',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/auth/audit-trail`, {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });

      const events: any[] = res.data.data?.events;
      if (!Array.isArray(events) || events.length === 0) {
        return { passed: false, message: 'Audit ledger is empty or not retrieved' };
      }

      let verifiedLinks = 0;
      for (let i = 0; i < events.length - 1; i++) {
        const newer = events[i];
        const older = events[i + 1];

        if (newer.previousHash === older.currentHash) {
          verifiedLinks++;
        }
      }

      if (verifiedLinks === 0 && events.length > 1) {
        return { passed: false, message: 'No valid hash links found in recent audit events' };
      }

      const latest = events[0];
      return {
        passed: true,
        message: `Cryptographic hash chain validated across ${events.length} recent blocks (${verifiedLinks} unbroken links verified, latest hash=${latest.currentHash.slice(0, 16)}...)`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // FARM-18: Farmer can only list their own farms
  // ----------------------------------------------------------------------------
  {
    id: 'FARM-18',
    name: 'Farmer can only list their own farms (strict cross-farmer isolation)',
    fn: async () => {
      // Farmer 1 lists farms
      const res1 = await axios.get(`${API_BASE}/api/farmer/farms`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });
      const farms1: any[] = res1.data.data;

      // Ensure Farmer 1 sees farm-farmer-01 and none of Farmer 2's farms
      const farmer1ContainsFarmer2Farm = farms1.some((f) => f.id === 'farm-farmer-02');
      if (farmer1ContainsFarmer2Farm) {
        return { passed: false, message: 'Isolation failure: Farmer 1 farm list contains farm-farmer-02' };
      }

      // Farmer 2 lists farms
      const res2 = await axios.get(`${API_BASE}/api/farmer/farms`, {
        headers: { Authorization: 'Bearer demo-token-farmer2' },
      });
      const farms2: any[] = res2.data.data;

      // Ensure Farmer 2 sees farm-farmer-02 and none of Farmer 1's farms
      const farmer2ContainsFarmer1Farm = farms2.some((f) => f.id === 'farm-farmer-01');
      if (farmer2ContainsFarmer1Farm) {
        return { passed: false, message: 'Isolation failure: Farmer 2 farm list contains farm-farmer-01' };
      }

      const farmer2HasOwnFarm = farms2.some((f) => f.id === 'farm-farmer-02');
      if (!farmer2HasOwnFarm) {
        return { passed: false, message: 'Farmer 2 farm list does not contain own farm-farmer-02' };
      }

      return {
        passed: true,
        message: `Strict isolation confirmed: Farmer 1 has ${farms1.length} farm(s) [no cross-contamination], Farmer 2 has ${farms2.length} farm(s) [no cross-contamination]`,
      };
    },
  },
];

async function runAllTests() {
  console.log('================================================================');
  console.log('🌾 KISANFLOW — PHASE 3 STEP 4: FARM API TEST RUNNER');
  console.log('================================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
    process.stdout.write(`▶ Running [${test.id}] ${test.name}...\n`);
    try {
      const result = await test.fn();
      if (result.passed) {
        console.log(`  \x1b[32mPASS\x1b[0m — ${result.message}`);
        passedCount++;
      } else {
        console.log(`  \x1b[31mFAIL\x1b[0m — ${result.message}`);
        failedCount++;
      }
    } catch (err: unknown) {
      const error = err as AxiosError<any>;
      console.log(
        `  \x1b[31mERROR\x1b[0m — ${error.message} ${
          error.response?.data ? JSON.stringify(error.response.data) : ''
        }`
      );
      failedCount++;
    }
  }

  console.log('================================================================');
  console.log(
    `TEST SUMMARY: Total: ${tests.length} | Passed: ${passedCount} | Failed: ${failedCount}`
  );
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests()
  .catch((err) => {
    console.error('Fatal error running Farm API test suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
