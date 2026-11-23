import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistance } from '../modules/hostel/hostel.service.js';
import { biometricsService } from '../modules/biometrics/biometrics.service.js';
import { getKolkataDateString, getKolkataTimeString } from '../modules/attendance/attendance.service.js';
import { generateHmac, verifyHmac } from '../utils/crypto.js';
import { env } from '../config/env.js';
import {
  checkInAttendanceSchema,
  manualOverrideSchema,
} from '../modules/attendance/attendance.validation.js';
import {
  applyGatePassSchema,
  reviewGatePassSchema,
} from '../modules/movement/movement.validation.js';
import { applyLeaveSchema } from '../modules/leave/leave.validation.js';
import { createTicketSchema } from '../modules/safety/safety.validation.js';
import { triageIntrusionSchema, addSingleRegistrySchema } from '../modules/admin/admin.validation.js';
import { realtimeEmitter } from '../realtime/events.js';

describe('Phase 3 Core Business APIs & Real-Time Engine Suite', () => {
  // --------------------------------------------------------------------------
  // 1. Haversine Distance & Geofencing Calculation
  // --------------------------------------------------------------------------
  describe('1. Geofence & Haversine Distance Calculation', () => {
    const hostelCenterLat = 15.8344;
    const hostelCenterLng = 78.0373;
    const geofenceRadiusMeters = 200;

    it('should calculate 0 meters distance for hostel center point', () => {
      const distance = calculateHaversineDistance(
        hostelCenterLat,
        hostelCenterLng,
        hostelCenterLat,
        hostelCenterLng
      );
      assert.equal(distance, 0);
    });

    it('should verify a coordinate inside the approved 200m hostel perimeter', () => {
      // Offset by approx 0.0005 degrees latitude (~55 meters)
      const insideLat = hostelCenterLat + 0.0005;
      const insideLng = hostelCenterLng;

      const distance = calculateHaversineDistance(
        hostelCenterLat,
        hostelCenterLng,
        insideLat,
        insideLng
      );

      assert.ok(distance > 0 && distance < geofenceRadiusMeters, `Distance ${distance}m must be within ${geofenceRadiusMeters}m`);
    });

    it('should correctly detect a coordinate outside the hostel perimeter', () => {
      // Offset by approx 0.01 degrees (~1.1 km away)
      const outsideLat = hostelCenterLat + 0.01;
      const outsideLng = hostelCenterLng + 0.01;

      const distance = calculateHaversineDistance(
        hostelCenterLat,
        hostelCenterLng,
        outsideLat,
        outsideLng
      );

      assert.ok(distance > geofenceRadiusMeters, `Distance ${distance}m must exceed ${geofenceRadiusMeters}m perimeter`);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Interactive Photo Metadata & Presentation-Attack Liveness
  // --------------------------------------------------------------------------
  describe('2. Biometric Photo Metadata & Liveness Evaluation', () => {
    const nowIso = new Date().toISOString();

    it('should pass all checks when photo metadata, liveness, and face match meet criteria', async () => {
      const result = await biometricsService.verifyPhotoMetadata({
        width: 720,
        height: 1280,
        captureTimestamp: nowIso,
        faceDetected: true,
        boundingBox: { x: 100, y: 150, width: 400, height: 600 },
        livenessScore: 0.96, // threshold is 0.90
        faceMatchConfidence: 0.94, // threshold is 0.85
      });

      assert.equal(result.passed, true);
      assert.equal(result.resolutionValid, true);
      assert.equal(result.freshnessValid, true);
      assert.equal(result.livenessPassed, true);
      assert.equal(result.faceMatchPassed, true);
      assert.equal(result.stageFailed, undefined);
    });

    it('should fail when liveness score is below the anti-spoofing threshold (0.90)', async () => {
      const result = await biometricsService.verifyPhotoMetadata({
        width: 720,
        height: 1280,
        captureTimestamp: nowIso,
        faceDetected: true,
        boundingBox: { x: 100, y: 150, width: 400, height: 600 },
        livenessScore: 0.65, // Below 0.90 -> presentation attack risk
        faceMatchConfidence: 0.94,
      });

      assert.equal(result.passed, false);
      assert.equal(result.livenessPassed, false);
      assert.equal(result.stageFailed, 'LIVENESS');
      assert.ok(result.reason?.includes('Liveness presentation attack detected'));
    });

    it('should fail when face match similarity is below confidence threshold (0.85)', async () => {
      const result = await biometricsService.verifyPhotoMetadata({
        width: 720,
        height: 1280,
        captureTimestamp: nowIso,
        faceDetected: true,
        boundingBox: { x: 100, y: 150, width: 400, height: 600 },
        livenessScore: 0.95,
        faceMatchConfidence: 0.72, // Below 0.85 -> different person
      });

      assert.equal(result.passed, false);
      assert.equal(result.faceMatchPassed, false);
      assert.equal(result.stageFailed, 'FACE_MATCH');
    });

    it('should reject stale or pre-recorded photos (> 60 seconds old)', async () => {
      const twoMinutesAgoIso = new Date(Date.now() - 120 * 1000).toISOString();

      const result = await biometricsService.verifyPhotoMetadata({
        width: 720,
        height: 1280,
        captureTimestamp: twoMinutesAgoIso,
        faceDetected: true,
        livenessScore: 0.95,
        faceMatchConfidence: 0.95,
      });

      assert.equal(result.passed, false);
      assert.equal(result.freshnessValid, false);
      assert.equal(result.stageFailed, 'FACE_CAPTURE');
      assert.ok(result.reason?.includes('stale or manipulated'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Digital QR Gate Pass HMAC-SHA-256 Signature
  // --------------------------------------------------------------------------
  describe('3. Digital QR Gate Pass Tamper-Proof HMAC Signing & Verification', () => {
    it('should create and verify valid Gate Pass QR digital signature', () => {
      const passNumber = 'GP-2026-X9Y8Z7';
      const studentId = 'student-uuid-4321';
      const validUntil = Date.now() + 4 * 3600 * 1000;

      const payloadString = `${passNumber}:${studentId}:${validUntil}`;
      const signature = generateHmac(payloadString, env.QR_SIGNING_SECRET);

      const isValid = verifyHmac(payloadString, signature, env.QR_SIGNING_SECRET);
      assert.equal(isValid, true, 'HMAC QR verification failed for legitimate pass');
    });

    it('should detect altered pass number or expiration in QR digital signature', () => {
      const passNumber = 'GP-2026-X9Y8Z7';
      const studentId = 'student-uuid-4321';
      const validUntil = Date.now() + 4 * 3600 * 1000;

      const payloadString = `${passNumber}:${studentId}:${validUntil}`;
      const signature = generateHmac(payloadString, env.QR_SIGNING_SECRET);

      // Attacker attempts to extend validity by 24 hours
      const tamperedPayloadString = `${passNumber}:${studentId}:${validUntil + 86400000}`;
      const isTamperedValid = verifyHmac(tamperedPayloadString, signature, env.QR_SIGNING_SECRET);

      assert.equal(isTamperedValid, false, 'Tampered QR expiration must fail verification');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Server-Side Timezone Derivation (Asia/Kolkata)
  // --------------------------------------------------------------------------
  describe('4. Timezone-Aware Server Derivation (Asia/Kolkata)', () => {
    it('should correctly format date as YYYY-MM-DD in Asia/Kolkata', () => {
      const dateStr = getKolkataDateString();
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), `Invalid date format: ${dateStr}`);
    });

    it('should correctly format time as HH:mm (24h) in Asia/Kolkata', () => {
      const timeStr = getKolkataTimeString();
      assert.ok(/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr), `Invalid time format: ${timeStr}`);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Zod Schema Validation for All Phase 3 Endpoints
  // --------------------------------------------------------------------------
  describe('5. Schema Validation & Enforced Business Constraints', () => {
    it('should validate Attendance Check-In schema', () => {
      const validCheckIn = checkInAttendanceSchema.safeParse({
        body: {
          latitude: 15.8344,
          longitude: 78.0373,
          accuracyMeters: 8.5,
          captureTimestamp: new Date().toISOString(),
          faceConfidence: 0.95,
          livenessConfidence: 0.97,
        },
      });
      assert.equal(validCheckIn.success, true);

      // Invalid latitude
      const invalidLat = checkInAttendanceSchema.safeParse({
        body: {
          latitude: 95.0, // Invalid lat > 90
          longitude: 78.0373,
          accuracyMeters: 10,
          captureTimestamp: new Date().toISOString(),
        },
      });
      assert.equal(invalidLat.success, false);
    });

    it('should validate Manual Attendance Override schema', () => {
      const validOverride = manualOverrideSchema.safeParse({
        body: {
          studentId: 'student-uuid-1234',
          date: '2026-10-13',
          status: 'PRESENT',
          remarks: 'Student had fever; verified in sick room by Chief Warden.',
        },
      });
      assert.equal(validOverride.success, true);
    });

    it('should validate Gate Pass review schema', () => {
      const validReview = reviewGatePassSchema.safeParse({
        params: { id: 'pass-uuid-123' },
        body: {
          decision: 'APPROVE',
          remarks: 'Parent consent verified via phone call.',
        },
      });
      assert.equal(validReview.success, true);
    });

    it('should validate Gate Pass date ordering (validUntil > validFrom)', () => {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 3600 * 1000);

      const validPass = applyGatePassSchema.safeParse({
        body: {
          passType: 'DAY_PASS',
          destination: 'Kurnool Town Market',
          reason: 'Academic project materials purchase',
          validFrom: now.toISOString(),
          validUntil: oneHourLater.toISOString(),
          parentConfirmed: true,
        },
      });
      assert.equal(validPass.success, true);

      // Inverted dates
      const invalidDates = applyGatePassSchema.safeParse({
        body: {
          passType: 'DAY_PASS',
          destination: 'Town',
          reason: 'Shopping',
          validFrom: oneHourLater.toISOString(),
          validUntil: now.toISOString(),
        },
      });
      assert.equal(invalidDates.success, false);
    });

    it('should validate Leave Request dates (toDate >= fromDate)', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000 * 3);

      const validLeave = applyLeaveSchema.safeParse({
        body: {
          leaveType: 'HOME_VISIT',
          reasonCategory: 'Festival',
          reasonDetails: 'Ugadi celebration at hometown with parents',
          fromDate: now.toISOString(),
          toDate: future.toISOString(),
          expectedReturnDate: future.toISOString(),
          parentConsentVerified: true,
          parentConsentMethod: 'PHONE_CALL',
        },
      });
      assert.equal(validLeave.success, true);
    });

    it('should validate Safety Ticket schema', () => {
      const validTicket = createTicketSchema.safeParse({
        body: {
          category: 'CORRIDOR_LIGHTING',
          title: 'Flickering tube light in 2nd floor west corridor',
          description: 'The tube light near room A-208 has been flickering intermittently since yesterday evening.',
          priority: 'MEDIUM',
          isAnonymous: false,
        },
      });
      assert.equal(validTicket.success, true);
    });

    it('should validate Intrusion Triage schema', () => {
      const validTriage = triageIntrusionSchema.safeParse({
        params: { id: 'intrusion-id-123' },
        body: {
          status: 'WHITELISTED',
          reviewNotes: 'Late admission authorized by Dean Student Affairs',
          whitelistData: {
            studentName: 'N. Ananya',
            blockCode: 'A',
            roomNumber: 'A-102',
            academicYear: 1,
            branch: 'CSE',
            section: 'A',
          },
        },
      });
      assert.equal(validTriage.success, true);
    });

    it('should validate Master Registry student entry schema with @gprec.ac.in lock', () => {
      const validReg = addSingleRegistrySchema.safeParse({
        body: {
          registrationNumber: '239X1A0588',
          collegeEmail: '239x1a0588@gprec.ac.in',
          studentName: 'K. Sneha',
          blockCode: 'B',
          roomNumber: 'B-105',
          academicYear: 1,
          branch: 'CSE',
          section: 'B',
        },
      });
      assert.equal(validReg.success, true);

      // External domain rejected
      const invalidDomain = addSingleRegistrySchema.safeParse({
        body: {
          registrationNumber: '239X1A0588',
          collegeEmail: 'sneha@gmail.com',
          studentName: 'K. Sneha',
          blockCode: 'B',
          roomNumber: 'B-105',
          academicYear: 1,
          branch: 'CSE',
          section: 'B',
        },
      });
      assert.equal(invalidDomain.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Real-Time Engine Event Dispatchers (Unit Safety)
  // --------------------------------------------------------------------------
  describe('6. Real-Time Engine Emitter Robustness', () => {
    it('should safely dispatch events without crashing when socket server is unattached or idle', () => {
      // Emitters should gracefully handle null or unattached socket server
      assert.doesNotThrow(() => {
        realtimeEmitter.emitSosTriggered({
          id: 'test-sos-1',
          studentId: 'student-1',
          studentName: 'Test Student',
          registrationNumber: '219X1A0501',
          blockCode: 'A',
          blockName: 'Arundhathi',
          roomNumber: 'A-101',
          triggerType: 'INSTANT',
          status: 'TRIGGERED',
          createdAt: new Date().toISOString(),
        });
      });

      assert.doesNotThrow(() => {
        realtimeEmitter.emitAttendanceRecorded({
          id: 'test-att-1',
          studentId: 'student-1',
          registrationNumber: '219X1A0501',
          studentName: 'Test Student',
          blockCode: 'A',
          roomNumber: 'A-101',
          status: 'PRESENT',
          date: '2026-10-13',
          checkInTime: new Date().toISOString(),
          accuracyMeters: 8,
        });
      });

      assert.doesNotThrow(() => {
        realtimeEmitter.emitGatePassStatusChanged({
          id: 'pass-1',
          passNumber: 'GP-2026-001',
          studentId: 'student-1',
          studentName: 'Test Student',
          passType: 'DAY_PASS',
          destination: 'Town',
          status: 'APPROVED',
          validUntil: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      assert.doesNotThrow(() => {
        realtimeEmitter.emitIntrusionAlert({
          id: 'int-1',
          attemptedName: 'Unknown Hacker',
          registrationNumber: '00000000',
          email: 'unknown@external.com',
          failureReason: 'Access Denied',
          status: 'BLOCKED',
          attemptedAt: new Date().toISOString(),
        });
      });
    });
  });
});
