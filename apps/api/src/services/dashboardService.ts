// ==============================================================================
// KisanFlow — Phase 5: Dashboard Service
// Exposes operational dashboards for Farmers, Center Operators, and Admins
// ==============================================================================

import { prisma } from '../config/prisma.ts';
import {
  FarmerDashboardDTO,
  CenterDashboardDTO,
  AdminDashboardDTO,
  FarmerBookingSummaryDTO,
  LifecycleStage,
} from '@kisanflow/types';
import { ApiError } from '../middleware/errorHandler.ts';

export class DashboardService {
  /**
   * Farmer Dashboard: Consolidated operational summary with strict IDOR isolation
   */
  public static async getFarmerDashboard(userId: string): Promise<FarmerDashboardDTO> {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
      include: {
        user: true,
        farms: true,
      },
    });

    if (!farmerProfile) {
      throw new ApiError(404, 'Farmer profile not found for authenticated user');
    }

    // 1. Calculate profile completion percentage
    let completedFields = 0;
    const totalFields = 8;
    if (farmerProfile.fullName) completedFields++;
    if (farmerProfile.address) completedFields++;
    if (farmerProfile.village) completedFields++;
    if (farmerProfile.bankAccountNumber) completedFields++;
    if (farmerProfile.bankIfsc) completedFields++;
    if (farmerProfile.aadhaarHash) completedFields++;
    if (farmerProfile.farms && farmerProfile.farms.length > 0) completedFields++;
    if (farmerProfile.kisanCreditCard) completedFields++;
    const profileCompletionPercentage = Math.round((completedFields / totalFields) * 100);

    const isLandVerified = farmerProfile.farms
      ? farmerProfile.farms.some((f: any) => f.isLandVerified || f.verificationStatus === 'VERIFIED')
      : false;

    // 2. Fetch Farmer Crops
    const farmerCrops = await prisma.farmerCrop.findMany({
      where: { farmerProfileId: farmerProfile.id },
      include: { crop: true },
      orderBy: { createdAt: 'desc' },
    });

    const activeCrops = farmerCrops.filter((fc: any) => fc.status === 'VERIFIED' || fc.status === 'APPROVED' || fc.status === 'ACTIVE' || fc.status === 'DRAFT');

    // 3. Fetch Bookings with relations
    const bookings = await prisma.booking.findMany({
      where: { farmerProfileId: farmerProfile.id },
      include: {
        crop: true,
        procurementCenter: true,
        bookingSlot: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    const bookingIds = bookings.map((b: any) => b.id);
    const qualityInspections = await (prisma as any).qualityInspection.findMany({
      where: { bookingId: { in: bookingIds } },
    });
    const weighments = await (prisma as any).weighment.findMany({
      where: { bookingId: { in: bookingIds } },
    });

    // Fetch settlements and payments for this farmer
    const settlements = await prisma.settlement.findMany({
      where: { farmerProfileId: farmerProfile.id },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });

    const payments = await prisma.payment.findMany({
      where: { farmerProfileId: farmerProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch transport requests for these bookings
    const transportRequests = await prisma.transportRequest.findMany({
      where: { bookingId: { in: bookingIds } },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });

    // Map bookings to summary DTO with 7-stage lifecycle derivation
    const bookingSummaries: FarmerBookingSummaryDTO[] = bookings.map((b: any) => {
      const inspection = qualityInspections.find((qi: any) => qi.bookingId === b.id) || null;
      const weighment = weighments.find((w: any) => w.bookingId === b.id) || null;
      const settlement = settlements.find((s: any) => s.bookingId === b.id) || null;
      const payment = payments.find((p: any) => settlement && p.settlementId === settlement.id) || null;
      const transport = transportRequests.find((tr: any) => tr.bookingId === b.id) || null;

      const lifecycleStage = this.deriveLifecycleStage(b.status, inspection, weighment, settlement, payment, transport);

      const slotTime = b.slot
        ? `${new Date(b.slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(b.slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Standard Window';

      return {
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        bookingDate: new Date(b.bookingDate).toISOString(),
        cropName: b.crop?.name || 'Crop',
        cropCode: b.crop?.code || 'CROP',
        centerName: b.procurementCenter?.name || 'Procurement Center',
        centerCode: b.procurementCenter?.code || 'CENTER',
        slotTime,
        estimatedQuantityQuintals: Number(b.estimatedQuantityQuintals),
        lockedRatePerQuintal: Number(b.lockedRatePerQuintal),
        tokenNumber: b.tokenNumber,
        status: b.status,
        lifecycleStage,
        inspection: inspection
          ? {
              status: inspection.status,
              finalGrade: inspection.finalGrade,
              moisturePercentage: Number(inspection.moisturePercentage),
              effectiveRate: Number(inspection.effectiveRatePerQuintal),
            }
          : null,
        weighment: weighment
          ? {
              grossWeight: Number(weighment.grossWeightQuintals),
              tareWeight: Number(weighment.tareWeightQuintals),
              netWeight: Number(weighment.netWeightQuintals),
              finalPayableAmount: Number(weighment.finalPayableAmount),
            }
          : null,
        settlement: settlement
          ? {
              settlementReference: settlement.settlementReference,
              grossAmount: Number(settlement.grossAmount),
              deductions: Number(settlement.deductions),
              netPayableAmount: Number(settlement.netPayableAmount),
              status: settlement.status,
            }
          : null,
        payment: payment
          ? {
              paymentReference: payment.paymentReference,
              amountInr: Number(payment.amountInr),
              status: payment.status,
              utrNumber: payment.utrNumber || null,
              disbursedAt: payment.disbursedAt ? new Date(payment.disbursedAt).toISOString() : null,
            }
          : null,
        transport: transport
          ? {
              requestReference: transport.requestReference,
              status: transport.status,
              vehicleRegistration: transport.vehicle?.registrationNumber || null,
              dispatchedAt: transport.dispatchedAt ? new Date(transport.dispatchedAt).toISOString() : null,
              deliveredAt: transport.deliveredAt ? new Date(transport.deliveredAt).toISOString() : null,
            }
          : null,
      };
    });

    const activeBooking = bookingSummaries.find(
      (b) =>
        b.status === 'CHECKED_IN' ||
        b.status === 'IN_QUEUE' ||
        b.status === 'PROCESSING' ||
        b.status === 'QUALITY_ASSESSED' ||
        b.status === 'WEIGHED'
    ) || null;

    const upcomingBookings = bookingSummaries.filter(
      (b) => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'RESCHEDULED'
    );

    const bookingHistory = bookingSummaries.filter(
      (b) => b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'EXPIRED'
    );

    // 4. Completed Procurements
    const completedProcurements = bookingSummaries
      .filter((b) => b.weighment !== null || b.status === 'COMPLETED')
      .map((b) => {
        const netQty = b.weighment?.netWeight || b.estimatedQuantityQuintals;
        const effRate = b.inspection?.effectiveRate || b.lockedRatePerQuintal;
        const totalVal = b.weighment?.finalPayableAmount || b.settlement?.netPayableAmount || netQty * effRate;
        const deductions = b.settlement?.deductions || 0;

        return {
          bookingId: b.bookingId,
          cropName: b.cropName,
          netQuantityQuintals: netQty,
          lockedMspRate: b.lockedRatePerQuintal,
          qualityGrade: b.inspection?.finalGrade || 'GRADE_A',
          deductionsInr: deductions,
          effectiveRatePerQuintal: effRate,
          finalProcurementValueInr: totalVal,
          completedAt: b.bookingDate,
        };
      });

    const totalProcuredQuintals = completedProcurements.reduce((acc, p) => acc + p.netQuantityQuintals, 0);
    const totalProcurementValueInr = completedProcurements.reduce((acc, p) => acc + p.finalProcurementValueInr, 0);

    // 5. Payment Summary
    const totalSettlementAmountInr = settlements.reduce((acc: number, s: any) => acc + Number(s.netPayableAmount), 0);
    const successfulPayments = payments.filter((p: any) => p.status === 'SUCCESS');
    const totalPaidInr = successfulPayments.reduce((acc: number, p: any) => acc + Number(p.amountInr), 0);
    const pendingAmountInr = Math.max(0, totalSettlementAmountInr - totalPaidInr);
    const latestPayment = successfulPayments[0] || null;

    // 6. Transport Summary
    const activeShipments = transportRequests.map((tr: any) => {
      const associatedBooking = bookings.find((b: any) => b.id === tr.bookingId) as any;
      return {
        transportRequestId: tr.id,
        requestReference: tr.requestReference,
        bookingNumber: associatedBooking?.bookingNumber || 'N/A',
        cropName: associatedBooking?.crop?.name || 'Grain',
        quantityQuintals: Number(tr.quantityQuintals),
        status: tr.status,
        vehicleRegistration: tr.vehicle?.registrationNumber || null,
        destinationName: tr.destinationName,
        dispatchedAt: tr.dispatchedAt ? new Date(tr.dispatchedAt).toISOString() : null,
        deliveredAt: tr.deliveredAt ? new Date(tr.deliveredAt).toISOString() : null,
      };
    });

    const deliveredCount = activeShipments.filter((s: any) => s.status === 'DELIVERED').length;
    const inTransitCount = activeShipments.filter((s: any) => s.status === 'DISPATCHED' || s.status === 'IN_TRANSIT' || s.status === 'ARRIVED').length;

    return {
      farmer: {
        id: farmerProfile.id,
        userId: farmerProfile.userId,
        fullName: farmerProfile.fullName || farmerProfile.user?.name || 'Farmer',
        phone: farmerProfile.user?.phone || 'N/A',
        primaryDistrict: farmerProfile.primaryDistrict,
        primaryState: farmerProfile.primaryState,
        profileCompletionPercentage,
        isLandVerified,
      },
      crops: {
        totalRegistered: farmerCrops.length,
        activeCount: activeCrops.length,
        crops: farmerCrops.map((fc: any) => ({
          id: fc.id,
          cropName: fc.crop?.name || 'Crop',
          cropCode: fc.crop?.code || 'CROP',
          season: fc.season,
          cultivatedArea: Number(fc.cultivatedArea),
          expectedYield: fc.expectedYield ? Number(fc.expectedYield) : null,
          status: fc.status,
        })),
      },
      bookings: {
        totalBookings: bookings.length,
        activeBooking,
        upcomingBookings,
        bookingHistory,
      },
      procurement: {
        totalProcuredQuintals,
        totalProcurementValueInr,
        completedProcurements,
      },
      payments: {
        totalSettlementAmountInr,
        totalPaidInr,
        pendingAmountInr,
        disbursementCount: successfulPayments.length,
        latestUtrNumber: latestPayment?.utrNumber || null,
        latestPaymentDate: latestPayment?.disbursedAt ? new Date(latestPayment.disbursedAt).toISOString() : null,
      },
      transport: {
        totalShipments: activeShipments.length,
        inTransitCount,
        deliveredCount,
        activeShipments,
      },
    };
  }

  /**
   * Center Dashboard: Operational view for center operators and inspectors
   */
  public static async getCenterDashboard(
    centerId: string,
    user: { id: string; role: string; operatorCenterId?: string | null },
    filters?: { date?: string; cropId?: string }
  ): Promise<CenterDashboardDTO> {
    // Authorization check: Admins or operators assigned to this center
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'GOVERNMENT_ADMIN';
    const isAssignedOperator = user.operatorCenterId === centerId;

    if (!isAdmin && !isAssignedOperator) {
      throw new ApiError(403, 'Forbidden: You do not have permission to view operations for this center');
    }

    const center = await prisma.procurementCenter.findUnique({
      where: { id: centerId },
      include: { bays: true },
    });

    if (!center) {
      throw new ApiError(404, 'Procurement center not found');
    }

    // Bookings for this center
    const bookingWhere: any = { procurementCenterId: centerId };
    if (filters?.cropId) {
      bookingWhere.cropId = filters.cropId;
    }

    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      include: {
        crop: true,
        bookingSlot: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    // Slots for today / filtered date
    const targetDateStr = filters?.date || new Date().toISOString().split('T')[0];
    const slots = await prisma.bookingSlot.findMany({
      where: {
        procurementCenterId: centerId,
      },
      orderBy: { startTime: 'asc' },
    });

    const dateSlots = slots.filter((s: any) => {
      const sDateStr = new Date(s.slotDate).toISOString().split('T')[0];
      return sDateStr === targetDateStr;
    });

    const relevantSlots = dateSlots.length > 0 ? dateSlots : slots;

    // Filter bookings for today / target date
    const todayBookings = bookings.filter((b: any) => {
      const bDateStr = new Date(b.bookingDate).toISOString().split('T')[0];
      return bDateStr === targetDateStr;
    });

    const opBookings = todayBookings.length > 0 ? todayBookings : bookings;

    const checkedIn = opBookings.filter((b: any) => b.status === 'CHECKED_IN').length;
    const waitingQueue = opBookings.filter((b: any) => b.status === 'IN_QUEUE').length;
    const processing = opBookings.filter((b: any) => b.status === 'PROCESSING' || b.status === 'QUALITY_ASSESSED' || b.status === 'WEIGHED').length;
    const completed = opBookings.filter((b: any) => b.status === 'COMPLETED').length;
    const cancelled = opBookings.filter((b: any) => b.status === 'CANCELLED' || b.status === 'EXPIRED').length;

    // Capacity metrics
    const totalDailyCapacity = Number(center.dailyCapacityQuintals);
    const allocatedCapacity = opBookings
      .filter((b: any) => b.status !== 'CANCELLED' && b.status !== 'EXPIRED')
      .reduce((acc: number, b: any) => acc + Number(b.estimatedQuantityQuintals), 0);
    const remainingCapacity = Math.max(0, totalDailyCapacity - allocatedCapacity);
    const utilizationPercentage = totalDailyCapacity > 0 ? Math.min(100, Math.round((allocatedCapacity / totalDailyCapacity) * 100)) : 0;

    // Slot metrics
    const bookedSlotsCount = relevantSlots.filter((s: any) => Number(s.bookedCapacityQuintals) > 0).length;
    const fullSlotsCount = relevantSlots.filter((s: any) => Number(s.bookedCapacityQuintals) >= Number(s.maxCapacityQuintals)).length;
    const availableSlotsCount = relevantSlots.length - fullSlotsCount;
    const nextAvailableSlot = relevantSlots.find((s: any) => Number(s.bookedCapacityQuintals) < Number(s.maxCapacityQuintals));
    const nextAvailableSlotTime = nextAvailableSlot
      ? `${new Date(nextAvailableSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null;

    // Quality metrics
    const qualityInspections = await prisma.qualityInspection.findMany({
      where: { procurementCenterId: centerId },
    });

    const passedInspections = qualityInspections.filter((qi: any) => qi.isMoisturePass && qi.finalGrade !== 'BELOW_FAQ');
    const failedInspections = qualityInspections.filter((qi: any) => !qi.isMoisturePass || qi.finalGrade === 'BELOW_FAQ');
    const reviewRequiredInspections = qualityInspections.filter((qi: any) => !qi.isHumanVerified);

    let totalMoisture = 0;
    qualityInspections.forEach((qi: any) => {
      totalMoisture += Number(qi.moisturePercentage);
    });
    const averageMoisturePercentage = qualityInspections.length > 0 ? Number((totalMoisture / qualityInspections.length).toFixed(2)) : 0;

    const gradeDistribution = {
      gradeA: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_A').length,
      gradeB: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_B').length,
      gradeC: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_C').length,
      belowFaq: qualityInspections.filter((qi: any) => qi.finalGrade === 'BELOW_FAQ').length,
    };

    // Weighment metrics
    const weighments = await prisma.weighment.findMany({
      where: { procurementCenterId: centerId },
    });

    const totalQuantityProcessedQuintals = weighments.reduce((acc: number, w: any) => acc + Number(w.netWeightQuintals), 0);
    const pendingWeighmentsCount = bookings.filter((b: any) => b.status === 'QUALITY_ASSESSED' && !weighments.some((w: any) => w.bookingId === b.id)).length;

    // Procurement breakdown by crop
    const cropBreakdownMap: Record<string, { cropId: string; cropName: string; cropCode: string; quantity: number; value: number }> = {};
    weighments.forEach((w: any) => {
      const b = bookings.find((item: any) => item.id === w.bookingId) as any;
      const cropId = b?.cropId || 'crop-unknown';
      const cropName = b?.crop?.name || 'Wheat';
      const cropCode = b?.crop?.code || 'WHEAT';

      if (!cropBreakdownMap[cropId]) {
        cropBreakdownMap[cropId] = {
          cropId,
          cropName,
          cropCode,
          quantity: 0,
          value: 0,
        };
      }
      cropBreakdownMap[cropId].quantity += Number(w.netWeightQuintals);
      cropBreakdownMap[cropId].value += Number(w.finalPayableAmount);
    });

    const cropBreakdown = Object.values(cropBreakdownMap).map((item) => ({
      cropId: item.cropId,
      cropName: item.cropName,
      cropCode: item.cropCode,
      quantityQuintals: item.quantity,
      totalValueInr: item.value,
    }));

    const totalProcuredQuantityQuintals = cropBreakdown.reduce((acc, c) => acc + c.quantityQuintals, 0);
    const totalProcurementValueInr = cropBreakdown.reduce((acc, c) => acc + c.totalValueInr, 0);

    // Payments for this center
    const centerBookingIds = bookings.map((b: any) => b.id);
    const settlements = await prisma.settlement.findMany({
      where: { bookingId: { in: centerBookingIds } },
    });

    const settlementIds = settlements.map((s: any) => s.id);
    const payments = await prisma.payment.findMany({
      where: { settlementId: { in: settlementIds } },
    });

    const totalSettlementAmountInr = settlements.reduce((acc: number, s: any) => acc + Number(s.netPayableAmount), 0);
    const successfulPayments = payments.filter((p: any) => p.status === 'SUCCESS');
    const successfulAmountInr = successfulPayments.reduce((acc: number, p: any) => acc + Number(p.amountInr), 0);
    const failedPaymentsCount = payments.filter((p: any) => p.status === 'FAILED').length;
    const pendingPaymentsCount = settlements.length - successfulPayments.length;

    // Transport requests
    const transportRequests = await prisma.transportRequest.findMany({
      where: { procurementCenterId: centerId },
    });

    const dispatchedCount = transportRequests.filter((tr: any) => tr.status === 'DISPATCHED').length;
    const inTransitCount = transportRequests.filter((tr: any) => tr.status === 'IN_TRANSIT' || tr.status === 'ARRIVED').length;
    const deliveredCount = transportRequests.filter((tr: any) => tr.status === 'DELIVERED').length;

    return {
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
        district: center.district,
        state: center.state,
        totalBays: center.bays?.length || 0,
        dailyCapacityQuintals: totalDailyCapacity,
        isActive: center.isActive,
      },
      todayOperations: {
        date: targetDateStr,
        totalBookings: opBookings.length,
        checkedIn,
        waitingQueue,
        processing,
        completed,
        cancelled,
      },
      capacity: {
        totalDailyCapacityQuintals: totalDailyCapacity,
        allocatedCapacityQuintals: allocatedCapacity,
        remainingCapacityQuintals: remainingCapacity,
        utilizationPercentage,
      },
      slots: {
        totalSlotsToday: relevantSlots.length,
        bookedSlotsCount,
        fullSlotsCount,
        availableSlotsCount,
        nextAvailableSlotTime,
      },
      quality: {
        totalInspections: qualityInspections.length,
        passed: passedInspections.length,
        failed: failedInspections.length,
        reviewRequired: reviewRequiredInspections.length,
        averageMoisturePercentage,
        gradeDistribution,
      },
      weighment: {
        totalWeighmentsCount: weighments.length,
        totalQuantityProcessedQuintals,
        pendingWeighmentsCount,
      },
      procurement: {
        totalProcuredQuantityQuintals,
        totalProcurementValueInr,
        cropBreakdown,
      },
      payments: {
        settlementsCreatedCount: settlements.length,
        totalSettlementAmountInr,
        successfulPaymentsCount: successfulPayments.length,
        successfulAmountInr,
        pendingPaymentsCount,
        failedPaymentsCount,
      },
      transport: {
        totalRequestsCount: transportRequests.length,
        dispatchedCount,
        inTransitCount,
        deliveredCount,
      },
    };
  }

  /**
   * Admin Dashboard: System-wide aggregated analytics
   */
  public static async getAdminDashboard(filters?: {
    startDate?: string;
    endDate?: string;
    centerId?: string;
    cropId?: string;
    state?: string;
    district?: string;
  }): Promise<AdminDashboardDTO> {
    // 1. Farmers
    const [allFarmers, activeFarmers, allFarmerCrops, allFarms] = await Promise.all([
      prisma.farmerProfile.findMany({ include: { user: true } }),
      prisma.farmerProfile.findMany({ where: { user: { isActive: true } } }),
      prisma.farmerCrop.findMany({ include: { crop: true } }),
      prisma.farm.findMany(),
    ]);

    const farmerIdsWithCrops = new Set(allFarmerCrops.map((fc: any) => fc.farmerProfileId));

    // 2. Crop Volumes
    const cropVolumeMap: Record<string, { cropId: string; cropName: string; cropCode: string; count: number; area: number; yield: number }> = {};
    allFarmerCrops.forEach((fc: any) => {
      const cId = fc.cropId;
      const cName = fc.crop?.name || 'Crop';
      const cCode = fc.crop?.code || 'CROP';

      if (!cropVolumeMap[cId]) {
        cropVolumeMap[cId] = {
          cropId: cId,
          cropName: cName,
          cropCode: cCode,
          count: 0,
          area: 0,
          yield: 0,
        };
      }
      cropVolumeMap[cId].count++;
      cropVolumeMap[cId].area += Number(fc.cultivatedArea);
      if (fc.expectedYield) cropVolumeMap[cId].yield += Number(fc.expectedYield);
    });

    const cropVolumes = Object.values(cropVolumeMap).map((cv) => ({
      cropId: cv.cropId,
      cropName: cv.cropName,
      cropCode: cv.cropCode,
      registrationsCount: cv.count,
      totalAreaAcres: cv.area,
      expectedYieldQuintals: cv.yield,
    }));

    const totalCultivatedAreaAcres = allFarms.reduce((acc: number, f: any) => acc + Number(f.totalAreaAcres), 0);

    // 3. Bookings and Procurements
    let bookings = await prisma.booking.findMany({
      include: {
        crop: true,
        procurementCenter: true,
      },
    });

    if (filters?.centerId) {
      bookings = bookings.filter((b: any) => b.procurementCenterId === filters.centerId);
    }
    if (filters?.cropId) {
      bookings = bookings.filter((b: any) => b.cropId === filters.cropId);
    }

    let allWeighments = await prisma.weighment.findMany();
    if (filters?.centerId) {
      allWeighments = allWeighments.filter((w: any) => w.procurementCenterId === filters.centerId);
    }

    const completedProcurements = bookings.filter((b: any) => b.status === 'COMPLETED' || allWeighments.some((w: any) => w.bookingId === b.id));

    const totalQuantityQuintals = allWeighments.reduce((acc: number, w: any) => acc + Number(w.netWeightQuintals), 0);
    const totalProcurementValueInr = allWeighments.reduce((acc: number, w: any) => acc + Number(w.finalPayableAmount), 0);

    // 4. MSP Rates & Exposure
    const mspRates = await prisma.mSPRate.findMany({
      where: { isActive: true },
      include: { crop: true },
    });

    const cropExposureMap: Record<string, { cropId: string; cropName: string; mspRate: number; bookedQty: number; exposure: number }> = {};
    bookings.forEach((b: any) => {
      const cId = b.cropId;
      const cName = b.crop?.name || 'Crop';
      const rate = Number(b.lockedRatePerQuintal);
      const qty = Number(b.estimatedQuantityQuintals);

      if (!cropExposureMap[cId]) {
        cropExposureMap[cId] = {
          cropId: cId,
          cropName: cName,
          mspRate: rate,
          bookedQty: 0,
          exposure: 0,
        };
      }
      cropExposureMap[cId].bookedQty += qty;
      cropExposureMap[cId].exposure += qty * rate;
    });

    const cropWiseExposure = Object.values(cropExposureMap).map((ce) => ({
      cropId: ce.cropId,
      cropName: ce.cropName,
      mspRate: ce.mspRate,
      bookedQuantityQuintals: ce.bookedQty,
      financialExposureInr: ce.exposure,
    }));

    // 5. Quality
    let qualityInspections = await prisma.qualityInspection.findMany();
    if (filters?.centerId) {
      qualityInspections = qualityInspections.filter((qi: any) => qi.procurementCenterId === filters.centerId);
    }

    const passCount = qualityInspections.filter((qi: any) => qi.isMoisturePass && qi.finalGrade !== 'BELOW_FAQ').length;
    const moistureFailuresCount = qualityInspections.filter((qi: any) => !qi.isMoisturePass).length;
    const reviewRequiredCount = qualityInspections.filter((qi: any) => !qi.isHumanVerified).length;

    const qualityGradeDistribution = {
      gradeA: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_A').length,
      gradeB: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_B').length,
      gradeC: qualityInspections.filter((qi: any) => qi.finalGrade === 'GRADE_C').length,
      belowFaq: qualityInspections.filter((qi: any) => qi.finalGrade === 'BELOW_FAQ').length,
    };

    // 6. Payments
    const settlements = await prisma.settlement.findMany();
    const payments = await prisma.payment.findMany();

    const totalGrossAmountInr = settlements.reduce((acc: number, s: any) => acc + Number(s.grossAmount), 0);
    const totalDeductionsInr = settlements.reduce((acc: number, s: any) => acc + Number(s.deductions), 0);
    const totalPayableAmountInr = settlements.reduce((acc: number, s: any) => acc + Number(s.netPayableAmount), 0);

    const successfulPayments = payments.filter((p: any) => p.status === 'SUCCESS');
    const totalDisbursedAmountInr = successfulPayments.reduce((acc: number, p: any) => acc + Number(p.amountInr), 0);
    const totalPendingAmountInr = Math.max(0, totalPayableAmountInr - totalDisbursedAmountInr);
    const failedPaymentsCount = payments.filter((p: any) => p.status === 'FAILED').length;
    const paymentSuccessRatePercentage = payments.length > 0 ? Math.round((successfulPayments.length / payments.length) * 100) : 100;

    // 7. Logistics
    let transportRequests = await prisma.transportRequest.findMany();
    if (filters?.centerId) {
      transportRequests = transportRequests.filter((tr: any) => tr.procurementCenterId === filters.centerId);
    }

    const totalQuantityMovedQuintals = transportRequests
      .filter((tr: any) => tr.status === 'DELIVERED' || tr.status === 'DISPATCHED' || tr.status === 'IN_TRANSIT')
      .reduce((acc: number, tr: any) => acc + Number(tr.quantityQuintals), 0);

    const logistics = {
      totalTransportRequests: transportRequests.length,
      requestedCount: transportRequests.filter((tr: any) => tr.status === 'REQUESTED').length,
      assignedCount: transportRequests.filter((tr: any) => tr.status === 'ASSIGNED').length,
      loadedCount: transportRequests.filter((tr: any) => tr.status === 'LOADED').length,
      dispatchedCount: transportRequests.filter((tr: any) => tr.status === 'DISPATCHED').length,
      inTransitCount: transportRequests.filter((tr: any) => tr.status === 'IN_TRANSIT').length,
      arrivedCount: transportRequests.filter((tr: any) => tr.status === 'ARRIVED').length,
      deliveredCount: transportRequests.filter((tr: any) => tr.status === 'DELIVERED').length,
      cancelledCount: transportRequests.filter((tr: any) => tr.status === 'CANCELLED').length,
      totalQuantityMovedQuintals,
    };

    // 8. Centers Leaderboard
    const centers = await prisma.procurementCenter.findMany();
    const centerLeaderboard = centers.map((c: any) => {
      const cWeighments = allWeighments.filter((w: any) => w.procurementCenterId === c.id);
      const cProcuredQty = cWeighments.reduce((acc: number, w: any) => acc + Number(w.netWeightQuintals), 0);
      const cProcuredVal = cWeighments.reduce((acc: number, w: any) => acc + Number(w.finalPayableAmount), 0);

      const cap = Number(c.dailyCapacityQuintals);
      const util = cap > 0 ? Math.min(100, Math.round((cProcuredQty / cap) * 100)) : 0;

      return {
        centerId: c.id,
        centerName: c.name,
        district: c.district,
        state: c.state,
        procuredQuantityQuintals: cProcuredQty,
        procurementValueInr: cProcuredVal,
        utilizationPercentage: util,
      };
    });

    centerLeaderboard.sort((a, b) => b.procuredQuantityQuintals - a.procuredQuantityQuintals);

    const avgUtilization =
      centerLeaderboard.length > 0
        ? Math.round(centerLeaderboard.reduce((acc, c) => acc + c.utilizationPercentage, 0) / centerLeaderboard.length)
        : 0;

    return {
      farmers: {
        totalFarmers: allFarmers.length,
        activeFarmers: activeFarmers.length,
        farmersWithRegisteredCrops: farmerIdsWithCrops.size,
      },
      crops: {
        totalRegistrations: allFarmerCrops.length,
        totalCultivatedAreaAcres,
        cropVolumes,
      },
      procurement: {
        totalBookings: bookings.length,
        completedProcurementsCount: completedProcurements.length,
        totalQuantityQuintals,
        totalProcurementValueInr,
      },
      msp: {
        activeRatesCount: mspRates.length,
        cropWiseExposure,
      },
      quality: {
        totalInspections: qualityInspections.length,
        passCount,
        moistureFailuresCount,
        reviewRequiredCount,
        gradeDistribution: qualityGradeDistribution,
      },
      payments: {
        totalSettlementsCount: settlements.length,
        totalGrossAmountInr,
        totalDeductionsInr,
        totalPayableAmountInr,
        totalDisbursedAmountInr,
        totalPendingAmountInr,
        successfulPaymentsCount: successfulPayments.length,
        failedPaymentsCount,
        paymentSuccessRatePercentage,
      },
      logistics,
      centers: {
        totalCenters: centers.length,
        activeCenters: centers.filter((c: any) => c.isActive).length,
        averageCapacityUtilizationPercentage: avgUtilization,
        centerProcurementLeaderboard: centerLeaderboard,
      },
    };
  }

  private static deriveLifecycleStage(
    bookingStatus: string,
    inspection: any,
    weighment: any,
    settlement: any,
    payment: any,
    transport: any
  ): LifecycleStage {
    if (bookingStatus === 'CANCELLED' || bookingStatus === 'EXPIRED') {
      return 'CANCELLED';
    }
    if (transport && (transport.status === 'DELIVERED' || transport.status === 'ARRIVED')) {
      return 'DELIVERED';
    }
    if (payment && payment.status === 'SUCCESS') {
      return 'PAID';
    }
    if (settlement || bookingStatus === 'COMPLETED') {
      return 'PROCURED';
    }
    if (weighment || bookingStatus === 'WEIGHED') {
      return 'WEIGHED';
    }
    if (inspection || bookingStatus === 'QUALITY_ASSESSED') {
      return 'QUALITY';
    }
    if (
      bookingStatus === 'CHECKED_IN' ||
      bookingStatus === 'IN_QUEUE' ||
      bookingStatus === 'PROCESSING'
    ) {
      return 'CHECKED_IN';
    }
    return 'BOOKED';
  }
}
