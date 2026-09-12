// ==============================================================================
// KisanFlow — Crop Master & MSP Rates Verification Test Suite
// ==============================================================================

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32mPASS\x1b[0m — ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31mFAIL\x1b[0m — ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('🌱 KISANFLOW — CROP MASTER & MSP RATE ENGINE TEST RUNNER');
  console.log('================================================================');

  // [MSP-01] GET /api/crops returns active commodities with moisture limits and current MSP
  try {
    console.log('▶ Running [MSP-01] GET /api/crops returns active crops with MSP snapshot...');
    const res = await axios.get(`${BASE_URL}/crops`);
    assert(
      res.status === 200 && res.data.success && Array.isArray(res.data.data.crops) && res.data.data.crops.length >= 5,
      'Active crops listed successfully with count >= 5',
      `got count=${res.data.data?.crops?.length}`
    );
    const wheat = res.data.data.crops.find((c: any) => c.code === 'WHT-01');
    assert(
      wheat && wheat.currentMSP?.ratePerQuintal === '2275',
      'Wheat (WHT-01) has correct statutory MSP rate (₹2,275/quintal)',
      `rate=${wheat?.currentMSP?.ratePerQuintal}`
    );
  } catch (err: any) {
    assert(false, '[MSP-01] Failed to list active crops', err.message);
  }

  // [MSP-02] Category filter for crops
  try {
    console.log('▶ Running [MSP-02] GET /api/crops?category=Oilseeds filters commodities...');
    const res = await axios.get(`${BASE_URL}/crops?category=Oilseeds`);
    const crops = res.data.data.crops;
    const allOilseeds = crops.every((c: any) => c.category === 'Oilseeds');
    assert(res.status === 200 && allOilseeds && crops.length >= 2, 'Oilseeds filter matches Mustard and Soybean', `count=${crops.length}`);
  } catch (err: any) {
    assert(false, '[MSP-02] Failed to filter crops by category', err.message);
  }

  // [MSP-03] GET single crop by ID
  try {
    console.log('▶ Running [MSP-03] GET /api/crops/:cropId returns single crop details...');
    const res = await axios.get(`${BASE_URL}/crops/crop-paddy`);
    assert(
      res.status === 200 && res.data.data.crop.code === 'PDY-02' && res.data.data.crop.standardMoistureLimit === '17',
      'Paddy specification retrieved with standard moisture limit (17%)',
      `code=${res.data.data?.crop?.code}`
    );
  } catch (err: any) {
    assert(false, '[MSP-03] Failed to retrieve single crop', err.message);
  }

  // [MSP-04] Non-existent crop returns 404
  try {
    console.log('▶ Running [MSP-04] GET /api/crops/invalid-id returns 404 NOT_FOUND...');
    await axios.get(`${BASE_URL}/crops/non-existent-crop-id`);
    assert(false, 'Non-existent crop should return 404');
  } catch (err: any) {
    assert(err.response?.status === 404 && err.response?.data?.error?.code === 'NOT_FOUND', 'Non-existent crop correctly returned 404 NOT_FOUND');
  }

  // [MSP-05] GET /api/msp returns official price benchmarks
  try {
    console.log('▶ Running [MSP-05] GET /api/msp returns statutory MSP benchmarks for 2026...');
    const res = await axios.get(`${BASE_URL}/msp?marketingYear=2026`);
    assert(
      res.status === 200 && res.data.success && Array.isArray(res.data.data.rates) && res.data.data.rates.length >= 5,
      'MSP rates retrieved successfully for marketing year 2026',
      `count=${res.data.data?.rates?.length}`
    );
    const mustard = res.data.data.rates.find((r: any) => r.crop?.code === 'MST-03');
    assert(
      mustard && mustard.ratePerQuintal === '5650',
      'Mustard MSP rate is ₹5,650/quintal as per official DAC&FW notification',
      `rate=${mustard?.ratePerQuintal}`
    );
  } catch (err: any) {
    assert(false, '[MSP-05] Failed to retrieve MSP rates', err.message);
  }

  // [MSP-06] Season filter on MSP rates
  try {
    console.log('▶ Running [MSP-06] GET /api/msp?season=RABI filters rates for Rabi season...');
    const res = await axios.get(`${BASE_URL}/msp?season=RABI`);
    const rates = res.data.data.rates;
    const allRabi = rates.every((r: any) => r.season === 'RABI');
    assert(res.status === 200 && allRabi && rates.length >= 2, 'Rabi season filter matches Wheat and Mustard', `count=${rates.length}`);
  } catch (err: any) {
    assert(false, '[MSP-06] Failed to filter MSP rates by season', err.message);
  }

  console.log('================================================================');
  console.log(`TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
