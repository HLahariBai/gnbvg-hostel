import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import type { NextFunction } from 'express';

import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import {
  requireAdmin,
  requireWardenOrAdmin,
} from '../middleware/auth.js';
import { csrfProtection, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../middleware/csrf.js';
import { generateCsrfToken } from '../utils/crypto.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import {
  socketAuthMiddleware,
  handleSocketConnection,
  setSocketServerForTesting,
} from '../realtime/socket.js';
import { realtimeEmitter } from '../realtime/events.js';
import { createEncryptedBackup, restoreEncryptedBackup } from '../utils/backup.js';

describe('Phase 5 Full-Stack Integration, Security Audit & Real-Time Sync Suite', () => {
  // Helper for mock HTTP requests and responses
  const createMockHttp = (overrides?: {
    method?: string;
    path?: string;
    user?: any;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  }) => {
    let statusCode = 200;
    let jsonBody: any = null;
    let nextCalled = false;
    let nextError: any = null;

    const req: any = {
      method: overrides?.method || 'GET',
      path: overrides?.path || '/api/test',
      user: overrides?.user,
      cookies: overrides?.cookies || {},
      headers: overrides?.headers || {},
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        jsonBody = body;
        return this;
      },
    };

    const next: NextFunction = (err?: any) => {
      nextCalled = true;
      if (err) nextError = err;
    };

    return {
      req,
      res,
      next,
      getStatusCode: () => statusCode,
      getJsonBody: () => jsonBody,
      isNextCalled: () => nextCalled,
      getNextError: () => nextError,
    };
  };

  // --------------------------------------------------------------------------
  // 1. Unauthorized Access & RBAC Least-Privilege Route Guards
  // --------------------------------------------------------------------------
  describe('1. Unauthorized Access Attempts & Strict RBAC Middleware', () => {
    it('should reject unauthenticated requests missing user session (401 Unauthorized)', () => {
      const mock = createMockHttp({ user: undefined });
      const wardenGuard = requireWardenOrAdmin;

      wardenGuard(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), true);
      const err = mock.getNextError();
      assert.ok(err instanceof UnauthorizedError);
      assert.equal(err.statusCode, 401);
    });

    it('should block a Student from accessing Warden/Admin restricted routes (403 Forbidden)', () => {
      const mock = createMockHttp({
        user: {
          userId: 'student-uuid-001',
          email: '219x1a0501@gprec.ac.in',
          role: Role.STUDENT,
        },
      });

      const wardenGuard = requireWardenOrAdmin;
      wardenGuard(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), true);
      const err = mock.getNextError();
      assert.ok(err instanceof ForbiddenError);
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /lacks permission|access denied/i);
    });

    it('should block a Warden from accessing exclusive Root Admin operations (403 Forbidden)', () => {
      const mock = createMockHttp({
        user: {
          userId: 'warden-uuid-002',
          email: 'warden.gnbvg@gprec.ac.in',
          role: Role.WARDEN,
        },
      });

      const adminGuard = requireAdmin;
      adminGuard(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), true);
      const err = mock.getNextError();
      assert.ok(err instanceof ForbiddenError);
      assert.equal(err.statusCode, 403);
    });

    it('should allow an Administrator to pass Root Admin checks cleanly', () => {
      const mock = createMockHttp({
        user: {
          userId: 'admin-uuid-003',
          email: 'admin.hostel@gprec.ac.in',
          role: Role.ADMIN,
        },
      });

      const adminGuard = requireAdmin;
      adminGuard(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), true);
      assert.equal(mock.getNextError(), null);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Double-Submit Anti-CSRF Cryptographic Verification
  // --------------------------------------------------------------------------
  describe('2. Double-Submit Anti-CSRF Protection Verification', () => {
    it('should allow safe HTTP read methods (GET, HEAD, OPTIONS) without CSRF tokens', () => {
      const mock = createMockHttp({ method: 'GET' });
      csrfProtection(mock.req, mock.res, mock.next);
      assert.equal(mock.isNextCalled(), true);
      assert.equal(mock.getNextError(), null);
    });

    it('should block state-changing POST requests when Anti-CSRF token is missing (403 Forbidden)', () => {
      const mock = createMockHttp({
        method: 'POST',
        cookies: {},
        headers: {},
      });

      csrfProtection(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), false);
      assert.equal(mock.getStatusCode(), 403);
      assert.equal(mock.getJsonBody()?.errorCode, 'CSRF_VALIDATION_FAILED');
    });

    it('should block state-changing POST requests when header token does not match cookie token', () => {
      const mock = createMockHttp({
        method: 'POST',
        cookies: { [CSRF_COOKIE_NAME]: 'valid_csrf_token_abc123' },
        headers: { [CSRF_HEADER_NAME]: 'tampered_or_stolen_token_xyz999' },
      });

      csrfProtection(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), false);
      assert.equal(mock.getStatusCode(), 403);
      assert.equal(mock.getJsonBody()?.errorCode, 'CSRF_VALIDATION_FAILED');
    });

    it('should allow state-changing POST requests when header matches cookie token', () => {
      const token = generateCsrfToken();
      const mock = createMockHttp({
        method: 'POST',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER_NAME]: token },
      });

      csrfProtection(mock.req, mock.res, mock.next);

      assert.equal(mock.isNextCalled(), true);
      assert.equal(mock.getNextError(), null);
    });
  });

  // --------------------------------------------------------------------------
  // 3. WebSocket Handshake Authentication & Multi-Tier Room Isolation
  // --------------------------------------------------------------------------
  describe('3. WebSocket Handshake Authentication & Multi-Tier Room Isolation', () => {
    let originalFindUnique: any;

    const studentUserId = 'usr-student-001';
    const studentProfileId = 'prof-student-001';
    const wardenUserId = 'usr-warden-002';

    before(() => {
      originalFindUnique = prisma.user.findUnique;
      (prisma.user.findUnique as any) = async (args: any) => {
        if (args.where?.id === studentUserId) {
          return {
            id: studentUserId,
            email: '219x1a0501@gprec.ac.in',
            role: Role.STUDENT,
            status: 'ACTIVE',
            studentProfile: {
              id: studentProfileId,
              block: { code: 'A', name: 'Arundhathi' },
            },
          };
        }
        if (args.where?.id === wardenUserId) {
          return {
            id: wardenUserId,
            email: 'warden.gnbvg@gprec.ac.in',
            role: Role.WARDEN,
            status: 'ACTIVE',
            studentProfile: null,
          };
        }
        if (args.where?.id === 'usr-inactive') {
          return {
            id: 'usr-inactive',
            email: 'suspended@gprec.ac.in',
            role: Role.STUDENT,
            status: 'SUSPENDED',
            studentProfile: null,
          };
        }
        return null;
      };
    });

    after(() => {
      (prisma.user.findUnique as any) = originalFindUnique;
    });

    it('should reject WebSocket handshake when access token is missing', async () => {
      const socket: any = { handshake: { headers: {}, auth: {} } };
      let errorReceived: Error | undefined;

      await socketAuthMiddleware(socket, (err) => {
        errorReceived = err;
      });

      assert.ok(errorReceived);
      assert.match(errorReceived.message, /missing access token/i);
    });

    it('should reject WebSocket handshake when access token is forged or corrupted', async () => {
      const socket: any = {
        handshake: {
          headers: {},
          auth: { token: 'forged.malformed.jwt.signature' },
        },
      };
      let errorReceived: Error | undefined;

      await socketAuthMiddleware(socket, (err) => {
        errorReceived = err;
      });

      assert.ok(errorReceived);
      assert.match(errorReceived.message, /invalid or expired websocket token/i);
    });

    it('should reject WebSocket handshake when account is inactive or revoked', async () => {
      const inactiveToken = jwt.sign(
        { userId: 'usr-inactive', email: 'suspended@gprec.ac.in', role: Role.STUDENT },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const socket: any = {
        handshake: {
          headers: {},
          auth: { token: inactiveToken },
        },
      };
      let errorReceived: Error | undefined;

      await socketAuthMiddleware(socket, (err) => {
        errorReceived = err;
      });

      assert.ok(errorReceived);
      assert.match(errorReceived.message, /inactive or revoked/i);
    });

    it('should authenticate a valid Student socket and verify room isolation', async () => {
      const studentToken = jwt.sign(
        { userId: studentUserId, email: '219x1a0501@gprec.ac.in', role: Role.STUDENT },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const socket: any = {
        id: 'sock-student-001',
        handshake: {
          headers: {
            cookie: `accessToken=${studentToken}`,
          },
          auth: {},
        },
        data: {},
      };

      let errorReceived: Error | undefined;
      await socketAuthMiddleware(socket, (err) => {
        errorReceived = err;
      });

      assert.equal(errorReceived, undefined);
      assert.equal(socket.data.user.role, Role.STUDENT);
      assert.equal(socket.data.user.studentId, studentProfileId);
      assert.equal(socket.data.user.blockCode, 'A');

      // Test Connection Handler Room Assignments
      const joinedRooms = new Set<string>();
      socket.join = (room: string) => joinedRooms.add(room);

      handleSocketConnection(socket);

      // Verify Student is in authorized channels
      assert.ok(joinedRooms.has(`user:${studentUserId}`));
      assert.ok(joinedRooms.has(`role:${Role.STUDENT}`));
      assert.ok(joinedRooms.has(`student:${studentProfileId}`));
      assert.ok(joinedRooms.has('block:A'));

      // Verify Student is strictly excluded from Warden/Admin feeds
      assert.equal(joinedRooms.has('warden-admin-feed'), false);
      assert.equal(joinedRooms.has(`role:${Role.WARDEN}`), false);
      assert.equal(joinedRooms.has(`role:${Role.ADMIN}`), false);
      assert.equal(joinedRooms.has('block:B'), false);
    });

    it('should authenticate a Warden socket and assign to warden-admin-feed and all blocks', async () => {
      const wardenToken = jwt.sign(
        { userId: wardenUserId, email: 'warden.gnbvg@gprec.ac.in', role: Role.WARDEN },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const socket: any = {
        id: 'sock-warden-002',
        handshake: {
          headers: {
            authorization: `Bearer ${wardenToken}`,
          },
          auth: {},
        },
        data: {},
      };

      let errorReceived: Error | undefined;
      await socketAuthMiddleware(socket, (err) => {
        errorReceived = err;
      });

      assert.equal(errorReceived, undefined);
      assert.equal(socket.data.user.role, Role.WARDEN);

      const joinedRooms = new Set<string>();
      socket.join = (room: string) => joinedRooms.add(room);

      handleSocketConnection(socket);

      // Verify Warden is in central safety channels and all blocks
      assert.ok(joinedRooms.has(`user:${wardenUserId}`));
      assert.ok(joinedRooms.has(`role:${Role.WARDEN}`));
      assert.ok(joinedRooms.has('warden-admin-feed'));
      assert.ok(joinedRooms.has('block:A'));
      assert.ok(joinedRooms.has('block:B'));
      assert.ok(joinedRooms.has('block:C'));

      // Verify Warden is NOT placed into student private inboxes
      assert.equal(joinedRooms.has(`student:${studentProfileId}`), false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. End-to-End Real-Time State Sync Between Concurrent Sessions
  // --------------------------------------------------------------------------
  describe('4. End-to-End Real-Time State Sync Between Concurrent Sessions', () => {
    // In-memory channel broadcaster simulating multi-session Socket.IO engine
    const rooms = new Map<string, Set<{ id: string; emit: (event: string, data: any) => void }>>();

    const mockIo: any = {
      to: (room: string) => ({
        emit: (event: string, payload: any) => {
          const subscribers = rooms.get(room);
          if (subscribers) {
            for (const sub of subscribers) {
              sub.emit(event, payload);
            }
          }
        },
      }),
    };

    before(() => {
      setSocketServerForTesting(mockIo);
    });

    after(() => {
      setSocketServerForTesting(null);
    });

    const createSession = (sessionId: string, user: any) => {
      const receivedEvents: Array<{ event: string; data: any }> = [];
      const socket: any = {
        id: sessionId,
        data: { user },
        join: (room: string) => {
          if (!rooms.has(room)) rooms.set(room, new Set());
          rooms.get(room)!.add(socket);
        },
        emit: (event: string, data: any) => {
          receivedEvents.push({ event, data });
        },
      };

      handleSocketConnection(socket);
      return { socket, receivedEvents };
    };

    it('should broadcast SOS emergency trigger from Student session to Warden session in real time', () => {
      // Session A: Student in Block A
      const studentSession = createSession('session-student-A', {
        userId: 'student-A',
        role: Role.STUDENT,
        studentId: 'prof-student-A',
        blockCode: 'A',
      });

      // Session B: Warden monitoring all hostel channels
      const wardenSession = createSession('session-warden-B', {
        userId: 'warden-B',
        role: Role.WARDEN,
      });

      // Session C: Another Student in Block B
      const studentBlockBSession = createSession('session-student-C', {
        userId: 'student-C',
        role: Role.STUDENT,
        studentId: 'prof-student-C',
        blockCode: 'B',
      });

      // Trigger SOS from Student A
      const sosPayload = {
        id: 'sos-alert-888',
        studentId: 'prof-student-A',
        studentName: 'S. Lakshmi Prasanna',
        registrationNumber: '219X1A0501',
        blockCode: 'A',
        blockName: 'Arundhathi',
        roomNumber: 'A-101',
        parentPhone: '9876543210',
        latitude: 15.8344,
        longitude: 78.0373,
        triggerType: 'PANIC_BUTTON_IMMEDIATE',
        status: 'TRIGGERED',
        createdAt: new Date().toISOString(),
      };

      realtimeEmitter.emitSosTriggered(sosPayload);

      // Verify Session B (Warden) received high-priority SOS emergency
      const wardenEvents = wardenSession.receivedEvents.filter((e) => e.event === 'sos:triggered');
      assert.equal(wardenEvents.length >= 1, true);
      assert.equal(wardenEvents[0].data.id, 'sos-alert-888');
      assert.equal(wardenEvents[0].data.registrationNumber, '219X1A0501');

      // Verify Session A (Student in Block A) received block notice
      const studentAEvents = studentSession.receivedEvents.filter((e) => e.event === 'sos:triggered');
      assert.equal(studentAEvents.length, 1);

      // Verify Session C (Student in Block B) DID NOT receive Block A alert
      const studentCEvents = studentBlockBSession.receivedEvents.filter((e) => e.event === 'sos:triggered');
      assert.equal(studentCEvents.length, 0);
    });

    it('should route Gate Pass status change strictly to the owning Student session', () => {
      const studentSession = createSession('session-student-A2', {
        userId: 'student-A',
        role: Role.STUDENT,
        studentId: 'prof-student-A',
        blockCode: 'A',
      });

      const otherStudentSession = createSession('session-student-D', {
        userId: 'student-D',
        role: Role.STUDENT,
        studentId: 'prof-student-D',
        blockCode: 'A',
      });

      const passPayload = {
        id: 'pass-999',
        passNumber: 'GP-2026-000999',
        studentId: 'prof-student-A',
        studentName: 'S. Lakshmi Prasanna',
        passType: 'DAY_PASS',
        destination: 'Kurnool City Center',
        status: 'APPROVED',
        validUntil: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      realtimeEmitter.emitGatePassStatusChanged(passPayload);

      // Verify Student A received the pass update in real-time
      const studentEvents = studentSession.receivedEvents.filter((e) => e.event === 'gatepass:status_changed');
      assert.equal(studentEvents.length, 1);
      assert.equal(studentEvents[0].data.status, 'APPROVED');
      assert.equal(studentEvents[0].data.passNumber, 'GP-2026-000999');

      // Verify Other Student DID NOT receive Student A's private pass
      const otherEvents = otherStudentSession.receivedEvents.filter((e) => e.event === 'gatepass:status_changed');
      assert.equal(otherEvents.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Database Backup AES-256-GCM Encryption & Tamper Detection
  // --------------------------------------------------------------------------
  describe('5. Database Backup AES-256-GCM Encryption & Tamper Detection', () => {
    const testBackupDir = path.resolve(process.cwd(), 'backups_test');

    after(() => {
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }
    });

    it('should create and restore an encrypted database backup with verified checksum', async () => {
      const backupPath = await createEncryptedBackup(testBackupDir);

      assert.ok(fs.existsSync(backupPath));
      assert.ok(backupPath.endsWith('.enc'));

      const metaPath = backupPath.replace(/\.enc$/, '.meta.json');
      assert.ok(fs.existsSync(metaPath));

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      assert.equal(meta.algorithm, 'aes-256-gcm');
      assert.ok(meta.sha256Checksum);

      // Decrypt and verify
      const decrypted = await restoreEncryptedBackup(backupPath);
      assert.ok(decrypted.length > 0);
      assert.match(decrypted.toString('utf8'), /GNBVG HOSTEL DATABASE/i);
    });

    it('should detect file tampering and reject restoration if ciphertext is altered', async () => {
      const backupPath = await createEncryptedBackup(testBackupDir);

      const buffer = fs.readFileSync(backupPath);
      // Flip a bit in the ciphertext portion (after IV [12] and Tag [16])
      buffer[buffer.length - 1] ^= 0xff;
      fs.writeFileSync(backupPath, buffer);

      await assert.rejects(
        async () => {
          await restoreEncryptedBackup(backupPath);
        },
        (err: Error) => {
          assert.match(err.message, /Decryption Failed|Authentication Tag mismatch/i);
          return true;
        }
      );
    });
  });
});
