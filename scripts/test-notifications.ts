// ==============================================================================
// KisanFlow — Phase 5 Verification: Notifications Engine & IDOR Security Test
// ==============================================================================

import { prisma } from '../apps/api/src/config/prisma.ts';
import { NotificationService } from '../apps/api/src/services/notificationService.ts';

async function runNotificationTests() {
  console.log('\n======================================================');
  console.log('🧪 KISANFLOW PHASE 5: NOTIFICATIONS & IDOR TEST SUITE');
  console.log('======================================================\n');

  // Step 1: Ensure test users exist
  let farmerUserA = await prisma.user.findFirst({ where: { phone: '9876543210' } });
  if (!farmerUserA) {
    farmerUserA = await prisma.user.create({
      data: {
        phone: '9876543210',
        name: 'Ramesh Patel',
        role: 'FARMER',
        isActive: true,
      },
    });
  }

  let farmerUserB = await prisma.user.findFirst({ where: { phone: '9876543211' } });
  if (!farmerUserB) {
    farmerUserB = await prisma.user.create({
      data: {
        phone: '9876543211',
        name: 'Suresh Kumar',
        role: 'FARMER',
        isActive: true,
      },
    });
  }

  console.log(`✅ Test Farmer A: ${farmerUserA.name} (${farmerUserA.id})`);
  console.log(`✅ Test Farmer B: ${farmerUserB.name} (${farmerUserB.id})`);

  // Step 2: Create initial notifications
  console.log('\n--- Step 2: Creating Test Notifications ---');
  const notif1 = await NotificationService.createNotification({
    userId: farmerUserA.id,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed: #BK-2026-001',
    message: 'Your slot at Indore Mandi is confirmed. Gate Token: GT-101.',
    severity: 'SUCCESS',
    entityType: 'BOOKING',
    entityId: 'bk-test-001',
    reference: 'BK-2026-001',
  });
  console.log(`✅ Notification 1 created: "${notif1.title}" (ID: ${notif1.id})`);

  const notif2 = await NotificationService.createNotification({
    userId: farmerUserA.id,
    type: 'PAYMENT_SUCCESS',
    title: 'DBT Payment Credited: ₹45,500',
    message: 'UTR: UTR99887766 has been credited to your bank account.',
    severity: 'SUCCESS',
    entityType: 'PAYMENT',
    entityId: 'pay-test-001',
    reference: 'PAY-2026-001',
  });
  console.log(`✅ Notification 2 created: "${notif2.title}" (ID: ${notif2.id})`);

  // Step 3: Test Deduplication Logic
  console.log('\n--- Step 3: Testing Deduplication Guard ---');
  const duplicateAttempt = await NotificationService.createNotification({
    userId: farmerUserA.id,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed: #BK-2026-001',
    message: 'Duplicate attempt for booking',
    severity: 'SUCCESS',
    entityType: 'BOOKING',
    entityId: 'bk-test-001',
    reference: 'BK-2026-001',
  });

  if (duplicateAttempt.id === notif1.id) {
    console.log(`✅ Deduplication verified: Returned existing notification (${duplicateAttempt.id}) instead of duplicating!`);
  } else {
    throw new Error(`❌ Deduplication failed: Duplicate notification created!`);
  }

  // Step 4: Test Fetch Notifications & Unread Count
  console.log('\n--- Step 4: Fetching Notifications & Counts ---');
  const feedA = await NotificationService.getNotifications(farmerUserA.id);
  console.log(`✅ Farmer A Feed: Total = ${feedA.total}, Unread = ${feedA.unreadCount}`);
  if (feedA.unreadCount < 2) {
    throw new Error(`❌ Expected at least 2 unread notifications for Farmer A, got ${feedA.unreadCount}`);
  }

  // Step 5: Test IDOR Protection (Farmer B trying to access Farmer A's notification)
  console.log('\n--- Step 5: IDOR Protection Test ---');
  try {
    await NotificationService.getNotificationById(farmerUserB.id, notif1.id, 'FARMER');
    throw new Error('❌ Security Failure: Farmer B accessed Farmer A notification!');
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes('Forbidden')) {
      console.log(`✅ IDOR Protection Verified: Farmer B blocked from accessing Farmer A notification (${err.message})`);
    } else {
      throw err;
    }
  }

  // Step 6: Test IDOR Protection on Mark As Read
  try {
    await NotificationService.markAsRead(farmerUserB.id, notif1.id);
    throw new Error('❌ Security Failure: Farmer B marked Farmer A notification as read!');
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes('Forbidden')) {
      console.log(`✅ IDOR Mark-As-Read Protection Verified: Farmer B blocked (${err.message})`);
    } else {
      throw err;
    }
  }

  // Step 7: Test Authorized Mark As Read
  console.log('\n--- Step 7: Authorized Mark As Read ---');
  const updatedNotif1 = await NotificationService.markAsRead(farmerUserA.id, notif1.id);
  if (updatedNotif1.isRead && updatedNotif1.readAt) {
    console.log(`✅ Notification marked as read at: ${updatedNotif1.readAt}`);
  } else {
    throw new Error('❌ Failed to mark notification as read');
  }

  const feedAfterRead = await NotificationService.getNotifications(farmerUserA.id);
  console.log(`✅ Unread count updated: ${feedAfterRead.unreadCount} unread remaining`);

  // Step 8: Test Mark All As Read
  console.log('\n--- Step 8: Mark All As Read ---');
  const markAllResult = await NotificationService.markAllAsRead(farmerUserA.id);
  console.log(`✅ Mark all as read affected count: ${markAllResult.count}`);

  const feedAfterReadAll = await NotificationService.getNotifications(farmerUserA.id);
  console.log(`✅ Unread count after mark-all: ${feedAfterReadAll.unreadCount}`);
  if (feedAfterReadAll.unreadCount !== 0) {
    throw new Error('❌ Expected 0 unread notifications after markAllAsRead');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL NOTIFICATION & IDOR TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runNotificationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Notification test failed:', err);
    process.exit(1);
  });
