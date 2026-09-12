// ==============================================================================
// KisanFlow — Master API Router
// ==============================================================================

import { Router } from 'express';
import healthRoutes from './health.routes.ts';
import authRoutes from './auth.routes.ts';
import securityTestRoutes from './testVerification.routes.ts';
import farmerRoutes from './farmer.routes.ts';
import cropRoutes from './crop.routes.ts';
import mspRoutes from './msp.routes.ts';
import bookingRoutes from './booking.routes.ts';
import centerRoutes from './center.routes.ts';
import gradingRoutes from './grading.routes.ts';
import weighmentRoutes from './weighment.routes.ts';
import settlementRoutes from './settlement.routes.ts';
import paymentRoutes from './payment.routes.ts';
import transportRoutes from './transport.routes.ts';
import notificationRoutes from './notification.routes.ts';
import dashboardRoutes from './dashboard.routes.ts';
import reportRoutes from './report.routes.ts';
import weatherRoutes from './weather.routes.ts';
import translationRoutes from './translation.routes.ts';
import mandiRoutes from './mandi.routes.ts';
import kccRoutes from './kcc.routes.ts';
import providerRoutes from './provider.routes.ts';
import { getPaymentsByFarmer } from '../controllers/payment.controller.ts';
import { requireAuth } from '../middleware/auth.ts';
import { createModuleRouter } from './modules.routes.ts';

const router = Router();

// 1. Health check route (Fully functional in Phase 1)
router.use('/', healthRoutes);

// 2. Authentication & Security Routes (Phase 2 Fully Functional)
router.use('/auth', authRoutes);
router.use('/', securityTestRoutes);

// 3. Farmer Profile Routes (Phase 3)
router.use('/farmer', farmerRoutes);

// 4. Crop Master & MSP Engine Routes (Phase 3 Active Catalog)
router.use('/crops', cropRoutes);
router.use('/msp', mspRoutes);

// 5. Procurement Centers & Slots (Phase 4 Active)
router.use('/centers', centerRoutes);
router.use('/procurement-centers', centerRoutes);

// 6. Smart Procurement Booking & MSP Lock (Phase 4 Active)
router.use('/bookings', bookingRoutes);

// 7. Phase 3 Quality & Procurement Engine (Active Systems)
router.use('/grading', gradingRoutes);
router.use('/quality-inspections', gradingRoutes);
router.use('/weighments', weighmentRoutes);
router.use('/procurement', weighmentRoutes);

// 8. Phase 4A Payment & Farmer Settlement Engine (Active Systems)
router.use('/settlements', settlementRoutes);
router.use('/settlement', settlementRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment', paymentRoutes);
router.get('/farmers/:farmerId/payments', requireAuth, getPaymentsByFarmer);

// 9. Phase 4B Transport & Logistics Engine (Active Systems)
router.use('/transport', transportRoutes);

// 10. Phase 5 Dashboards, Notifications & Reporting (Active Systems)
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);

// 11. External Free & Open-Data Integrations (Phase 7 Modernization)
router.use('/weather', weatherRoutes);
router.use('/translation', translationRoutes);
router.use('/mandi', mandiRoutes);
router.use('/kcc', kccRoutes);
router.use('/providers', providerRoutes);

// 12. Module Routes (Remaining Future Phases)

router.use('/users', createModuleRouter('User Management', ['Profile management', 'Role assignments', 'Language preference']));
router.use('/farmers', createModuleRouter('Farmer Profiles', ['KCC sync', 'PM-Kisan binding', 'Aadhaar zero-knowledge hash']));
router.use('/farms', createModuleRouter('Land Parcels & DILRMP', ['Khasra survey sync', 'Soil type records', 'Area verification']));
router.use('/queue', createModuleRouter('Live Mandi Queue & Redis', ['Virtual queuing', 'FIFO & priority routing', 'Wait-time projection']));
router.use('/gate', createModuleRouter('Gate Check-in & Security', ['Thermal pass generation', 'Vehicle plate logging', 'QR scan validation']));
router.use('/forecasts', createModuleRouter('Predictive Analytics', ['Mandi arrival load forecasting', 'Price trend forecasting']));
router.use('/anomalies', createModuleRouter('Anti-Fraud AI & Anomaly Detection', ['Yield mismatch detection', 'Duplicate claim flags', 'Weight tampering audit']));
router.use('/disputes', createModuleRouter('Farmer Grievance & Dispute Redressal', ['Grade appeal filing', 'Weight re-check requests', 'Resolution escalation']));
router.use('/audit', createModuleRouter('Tamper-Evident Cryptographic Ledger', ['SHA-256 hash chaining', 'Append-only ledger query', 'Integrity verification']));
router.use('/admin', createModuleRouter('Government Oversight & Analytics', ['State-wide procurement dashboards', 'MSP disbursement totals']));

export default router;
