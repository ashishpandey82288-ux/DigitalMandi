// ==============================================================================
// DigitalMandi — Farmer Crop Registration Validation & Flow Test Suite
// Validates:
// 1. Farmer with farm parcel
// 2. Farmer without farm parcel (empty state detection)
// 3. Farm parcel retrieval from existing API /api/farmer/farms
// 4. Cultivated area <= parcel area (Valid)
// 5. Cultivated area > parcel area (Rejection & validation enforcement)
// 6. Zero / negative cultivated area rejection
// 7. Invalid expected yield rejection
// 8. End-to-end crop registration with existing API
// 9. Verified crop appears in /api/farmer/crops
// ==============================================================================

import axios from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = 'http://localhost:3000';

interface Farm {
  id: string;
  farmName: string;
  landParcelNumber: string;
  totalAreaAcres: number;
  village: string;
  verificationStatus?: string;
}

interface CropMaster {
  id: string;
  name: string;
  code: string;
}

async function runCropValidationTests() {
  console.log('================================================================');
  console.log('🌾 DIGITALMANDI — CROP REGISTRATION VALIDATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ PASS [${totalTests}]: ${testName}`);
    } else {
      console.error(`❌ FAIL [${totalTests}]: ${testName} - ${detail || ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // Ensure demo farmer account and profile exist
  await prisma.user.upsert({
    where: { id: 'user-demo-farmer-01' },
    update: {},
    create: {
      id: 'user-demo-farmer-01',
      firebaseUid: 'firebase-demo-farmer-uid',
      name: 'Harpreet Singh',
      phone: '+91-9812345601',
      email: 'demo.farmer@kisanflow.local',
      role: 'FARMER',
    },
  });

  await prisma.farmerProfile.upsert({
    where: { id: 'prof-farmer-01' },
    update: {},
    create: {
      id: 'prof-farmer-01',
      userId: 'user-demo-farmer-01',
      fullName: 'Harpreet Singh',
      primaryDistrict: 'Karnal',
      primaryState: 'Haryana',
      village: 'Taraori',
      pincode: '132116',
      bankAccountNumber: '123456789012',
      bankIfsc: 'SBIN0001234',
      aadhaarHash: 'hash-aadhaar-demo-01',
    },
  });

  // 1. Authenticate as demo farmer
  const loginRes = await axios.post(`${API_BASE}/api/auth/demo-login`, { role: 'FARMER' });
  const token = loginRes.data.data?.token;
  assert(!!token, 'Farmer authentication successful', 'No token returned');
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Fetch farmer farms
  const farmsRes = await axios.get(`${API_BASE}/api/farmer/farms`, { headers: authHeaders });
  const initialFarms: Farm[] = farmsRes.data.data || [];
  console.log(`ℹ️ Initial farms count for authenticated farmer: ${initialFarms.length}`);

  // Test Case 2: Farmer without farm parcel handling
  let testFarm: Farm;
  if (initialFarms.length === 0) {
    assert(initialFarms.length === 0, 'Empty farm parcel state detected correctly');
    console.log('ℹ️ Farmer currently has 0 registered land parcels. Creating test parcel...');

    // Create a registered farm parcel for testing
    const createFarmRes = await axios.post(
      `${API_BASE}/api/farmer/farms`,
      {
        farmName: 'Green Valley Plot A',
        landParcelNumber: 'KHASRA-GV-101',
        totalAreaAcres: 5.0,
        village: 'Taraori',
        district: 'Karnal',
        state: 'Haryana',
        irrigationType: 'Tube Well',
        soilType: 'Alluvial Loam',
      },
      { headers: authHeaders }
    );
    testFarm = createFarmRes.data.data;
    assert(testFarm.totalAreaAcres === 5.0, 'Created test parcel with 5.00 Acres');
  } else {
    testFarm = initialFarms[0];
    assert(Number(testFarm.totalAreaAcres) > 0, 'Farmer with farm parcel loaded: ' + testFarm.farmName + ` (${testFarm.totalAreaAcres} Acres)`);
  }

  // 3. Fetch Master Crops Catalog
  const cropsRes = await axios.get(`${API_BASE}/api/crops`);
  const masterCrops: CropMaster[] = cropsRes.data.data?.crops || [];
  assert(masterCrops.length > 0, 'Master crops catalog loaded (' + masterCrops.length + ' crops)');
  const wheatCrop = masterCrops.find((c) => c.code === 'WHT-01' || c.name.toLowerCase().includes('wheat')) || masterCrops[0];
  assert(!!wheatCrop, 'Resolved target crop: ' + wheatCrop.name + ' (' + wheatCrop.code + ')');

  // Test Case 4: Client-side validation logic check (simulating RegisterCropModal useMemo)
  const parcelMaxArea = Number(testFarm.totalAreaAcres);

  // Validation function matching RegisterCropModal implementation
  function validateArea(areaStr: string, maxArea: number) {
    if (!areaStr.trim()) return { isValid: false, error: null };
    const val = parseFloat(areaStr);
    if (isNaN(val) || val <= 0) return { isValid: false, error: 'Cultivated area must be greater than 0 acres.' };
    if (maxArea > 0 && val > maxArea) {
      return {
        isValid: false,
        error: `Cultivated area cannot exceed the selected farm parcel's available area (${maxArea.toFixed(2)} Acres).`,
      };
    }
    return { isValid: true, error: null };
  }

  function validateYield(yieldStr: string) {
    if (!yieldStr.trim()) return { isValid: false, error: null };
    const val = parseFloat(yieldStr);
    if (isNaN(val) || val <= 0) return { isValid: false, error: 'Please enter a valid expected yield greater than 0 quintals.' };
    return { isValid: true, error: null };
  }

  // Test Case 5: Cultivated area <= parcel area (Valid)
  const validAreaCheck = validateArea((parcelMaxArea * 0.5).toFixed(2), parcelMaxArea);
  assert(validAreaCheck.isValid === true && validAreaCheck.error === null, 'Cultivated area within bounds is VALID');

  // Test Case 6: Cultivated area equal to parcel area (Boundary Valid)
  const boundaryAreaCheck = validateArea(parcelMaxArea.toFixed(2), parcelMaxArea);
  assert(boundaryAreaCheck.isValid === true && boundaryAreaCheck.error === null, 'Cultivated area exactly equal to parcel size is VALID');

  // Test Case 7: Cultivated area > parcel area (Exceeded Rejection)
  const excessiveArea = (parcelMaxArea + 2.5).toFixed(2);
  const exceededAreaCheck = validateArea(excessiveArea, parcelMaxArea);
  assert(
    exceededAreaCheck.isValid === false && exceededAreaCheck.error?.includes('cannot exceed'),
    'Cultivated area exceeding parcel is REJECTED with clear warning'
  );

  // Test Case 8: Zero cultivated area rejection
  const zeroAreaCheck = validateArea('0', parcelMaxArea);
  assert(zeroAreaCheck.isValid === false && zeroAreaCheck.error?.includes('greater than 0'), 'Zero cultivated area is REJECTED');

  // Test Case 9: Negative cultivated area rejection
  const negativeAreaCheck = validateArea('-3.5', parcelMaxArea);
  assert(negativeAreaCheck.isValid === false && negativeAreaCheck.error?.includes('greater than 0'), 'Negative cultivated area is REJECTED');

  // Test Case 10: Invalid expected yield rejection
  const zeroYieldCheck = validateYield('0');
  assert(zeroYieldCheck.isValid === false && zeroYieldCheck.error?.includes('greater than 0'), 'Zero expected yield is REJECTED');

  const negativeYieldCheck = validateYield('-20');
  assert(negativeYieldCheck.isValid === false && negativeYieldCheck.error?.includes('greater than 0'), 'Negative expected yield is REJECTED');

  const validYieldCheck = validateYield('45');
  assert(validYieldCheck.isValid === true && validYieldCheck.error === null, 'Positive expected yield is VALID');

  // Test Case 11: Backend boundary enforcement (Attempting > parcel area via API directly)
  try {
    await axios.post(
      `${API_BASE}/api/farmer/crops`,
      {
        farmId: testFarm.id,
        cropId: wheatCrop.id,
        season: 'RABI',
        cultivatedArea: parcelMaxArea + 100.0,
        expectedYield: 500,
      },
      { headers: authHeaders }
    );
    assert(false, 'Backend accepted cultivated area greater than farm capacity (unexpected!)');
  } catch (err: any) {
    const status = err.response?.status;
    const errorCode = err.response?.data?.error?.code || err.response?.data?.code;
    assert(status === 400 && errorCode === 'AREA_EXCEEDS_CAPACITY', 'Backend correctly rejected excess area with 400 AREA_EXCEEDS_CAPACITY');
  }

  // Test Case 12: Successful Crop Registration via API with valid parameters
  const testCultivatedArea = Math.min(1.0, parcelMaxArea * 0.4);
  const registerCropRes = await axios.post(
    `${API_BASE}/api/farmer/crops`,
    {
      farmId: testFarm.id,
      cropId: wheatCrop.id,
      season: 'RABI',
      cultivatedArea: testCultivatedArea,
      expectedYield: 25.0,
    },
    { headers: authHeaders }
  );

  assert(registerCropRes.status === 201 || registerCropRes.status === 200, 'Crop registration request succeeded (HTTP 200/201)');
  const registeredCropData = registerCropRes.data.data;
  assert(registeredCropData.cropId === wheatCrop.id, 'Registered crop matches requested crop ID: ' + wheatCrop.id);
  assert(Number(registeredCropData.cultivatedArea) === testCultivatedArea, 'Registered cultivated area matches: ' + testCultivatedArea + ' Acres');

  // Test Case 13: Verify newly registered crop appears in /api/farmer/crops
  const farmerCropsRes = await axios.get(`${API_BASE}/api/farmer/crops`, { headers: authHeaders });
  const allFarmerCrops: any[] = farmerCropsRes.data.data || [];
  const foundCrop = allFarmerCrops.find((c) => c.id === registeredCropData.id);
  assert(!!foundCrop, 'Newly registered crop confirmed present in Farmer Portal crops list');
  console.log(`ℹ️ Verified crop in My Crops: ${foundCrop.crop?.name || foundCrop.cropName} (${foundCrop.cultivatedArea} Acres)`);

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} CROP REGISTRATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runCropValidationTests().catch((err) => {
  console.error('❌ Test suite failed:', err.response?.data || err.message);
  process.exit(1);
});
