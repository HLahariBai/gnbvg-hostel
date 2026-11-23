import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { authenticator } from 'otplib';
import {
  hashPassword,
  verifyPassword,
  encryptAesGcm,
  decryptAesGcm,
  generateHmac,
  verifyHmac,
  generateCryptoNumericOtp,
  generateSecureToken,
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
  generateCsrfToken,
  verifyCsrfToken,
} from '../utils/crypto.js';
import {
  initiateRegistrationSchema,
  loginSchema,
} from '../modules/auth/auth.validation.js';
import {
  requireRole,
  requireStudent,
  requireWarden,
  requireAdmin,
  requireWardenOrAdmin,
} from '../middleware/auth.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';

describe('Phase 2 Security & Authentication Suite', () => {
  // --------------------------------------------------------------------------
  // 1. Institutional Domain Enforcement
  // --------------------------------------------------------------------------
  describe('1. Institutional Email Domain Enforcement (@gprec.ac.in)', () => {
    const validBaseBody = {
      fullName: 'Sravya Reddy',
      registrationNumber: '219X1A0501',
      collegeEmail: '219x1a0501@gprec.ac.in',
      password: 'StrongP@ssw0rd!2026',
      academicYear: 3,
      branch: 'CSE',
      section: 'A',
      primaryPhone: '9876543210',
      permanentAddress: 'Plot 42, Gayatri Nagar, Kurnool, AP - 518002',
      blockCode: 'A',
      roomNumber: 'A-101',
      fatherName: 'Venkata Reddy',
      fatherPhone: '9848012345',
    };

    it('should accept valid official institutional emails ending with @gprec.ac.in', () => {
      const validCases = [
        '219x1a0501@gprec.ac.in',
        'student.test@gprec.ac.in',
        'warden.gnbvg@gprec.ac.in',
      ];

      for (const email of validCases) {
        const result = initiateRegistrationSchema.safeParse({
          body: {
            ...validBaseBody,
            collegeEmail: email,
          },
        });
        assert.equal(result.success, true, `Failed on valid email: ${email}`);
        if (result.success) {
          assert.equal(result.data.body.collegeEmail, email);
        }
      }
    });

    it('should reject external, public, or spoofed email domains', () => {
      const invalidEmails = [
        'student@gmail.com',
        'student@yahoo.co.in',
        'student@gprec.ac.in.attacker.org',
        'student@fakegprec.ac.in',
        'student@gprec.org',
        'student@outlook.com',
        'not-an-email',
      ];

      for (const email of invalidEmails) {
        const result = initiateRegistrationSchema.safeParse({
          body: {
            ...validBaseBody,
            collegeEmail: email,
          },
        });
        assert.equal(result.success, false, `Should have rejected email: ${email}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Production Cryptographic Standards (Argon2id)
  // --------------------------------------------------------------------------
  describe('2. Argon2id Password Hashing & Verification', () => {
    it('should hash password with Argon2id algorithm parameters', async () => {
      const plainPassword = 'CorrectHorseBatteryStaple!2026';
      const hash = await hashPassword(plainPassword);

      // Verify Argon2id identifier and OWASP memory/time parameters
      assert.ok(hash.startsWith('$argon2id$v=19$'), 'Hash must use Argon2id v19');
      assert.ok(hash.includes('m=65536'), 'Hash must use 64MB memory cost (m=65536)');
      assert.ok(hash.includes('t=3'), 'Hash must use 3 iterations (t=3)');
      assert.ok(hash.includes('p=1'), 'Hash must use 1 thread (p=1)');

      // Verify positive password match
      const isValid = await verifyPassword(hash, plainPassword);
      assert.equal(isValid, true, 'Valid password verification failed');

      // Verify negative password match
      const isInvalid = await verifyPassword(hash, 'WrongP@ssword123');
      assert.equal(isInvalid, false, 'Invalid password should not match');
    });

    it('should generate unique salts for identical passwords', async () => {
      const pass = 'IdenticalPassword123!';
      const hash1 = await hashPassword(pass);
      const hash2 = await hashPassword(pass);

      assert.notEqual(hash1, hash2, 'Salts must be randomly generated for each hash');
      assert.equal(await verifyPassword(hash1, pass), true);
      assert.equal(await verifyPassword(hash2, pass), true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Field-Level AES-256-GCM Encryption & Tamper Detection
  // --------------------------------------------------------------------------
  describe('3. Field-Level AES-256-GCM Encryption with HMAC & Auth Tag', () => {
    it('should encrypt and decrypt plaintext accurately', () => {
      const sensitiveData = JSON.stringify({
        registrationNumber: '219X1A0501',
        primaryPhone: '9876543210',
        fatherPhone: '9848012345',
        permanentAddress: 'Door 1-23, Kurnool',
      });

      const encrypted = encryptAesGcm(sensitiveData);

      assert.ok(encrypted.combined.includes(':'), 'Combined payload format must be iv:tag:ciphertext');
      const parts = encrypted.combined.split(':');
      assert.equal(parts.length, 3, 'Combined payload must have 3 components');
      assert.equal(parts[0].length, 24, 'IV should be 12 bytes = 24 hex chars');
      assert.equal(parts[1].length, 32, 'GCM Auth tag should be 16 bytes = 32 hex chars');

      const decrypted = decryptAesGcm(encrypted.combined);
      assert.equal(decrypted, sensitiveData, 'Decrypted payload must match original plaintext');
    });

    it('should detect tampering with ciphertext or authentication tag', () => {
      const sensitiveData = 'High-Security-Student-Data-Token';
      const encrypted = encryptAesGcm(sensitiveData);

      // Tamper with ciphertext by altering last character
      const [iv, tag, ciphertext] = encrypted.combined.split(':');
      const tamperedCiphertext =
        ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
      const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

      assert.throws(
        () => decryptAesGcm(tamperedPayload),
        /Unsupported state or unable to authenticate data|Failed to decrypt AES-256-GCM payload/,
        'Tampered ciphertext must fail authentication tag verification'
      );

      // Tamper with authentication tag
      const tamperedTag = tag.slice(0, -1) + (tag.slice(-1) === '0' ? '1' : '0');
      const tamperedTagPayload = `${iv}:${tamperedTag}:${ciphertext}`;

      assert.throws(
        () => decryptAesGcm(tamperedTagPayload),
        /Unsupported state or unable to authenticate data|Failed to decrypt AES-256-GCM payload/,
        'Tampered authentication tag must fail decryption'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. HMAC-SHA-256 Integrity Verification
  // --------------------------------------------------------------------------
  describe('4. HMAC-SHA-256 Signature and Integrity Verification', () => {
    it('should generate deterministic HMAC for same message and key', () => {
      const data = 'GNBVG-ATTENDANCE-RECORD-2026-03-29';
      const hmac1 = generateHmac(data);
      const hmac2 = generateHmac(data);

      assert.equal(hmac1, hmac2);
      assert.equal(hmac1.length, 64, 'SHA-256 HMAC should be 64 hex characters');

      // Verify timing-safe verification
      assert.equal(verifyHmac(data, hmac1), true);
    });

    it('should reject tampered message with original HMAC', () => {
      const originalData = 'STUDENT:219X1A0501:OUTING_STATUS:APPROVED';
      const hmac = generateHmac(originalData);

      const tamperedData = 'STUDENT:219X1A0501:OUTING_STATUS:OVERRIDE';
      assert.equal(verifyHmac(tamperedData, hmac), false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. CSPRNG Numeric OTP & Token Generation
  // --------------------------------------------------------------------------
  describe('5. CSPRNG Token & OTP Generation', () => {
    it('should generate secure 6-digit numeric OTPs strictly within [000000, 999999]', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const otp = generateCryptoNumericOtp(6);
        assert.equal(otp.length, 6, 'OTP must be exactly 6 characters');
        assert.ok(/^\d{6}$/.test(otp), 'OTP must contain only digits');
        generated.add(otp);
      }
      // With CSPRNG, 50 random 6-digit values should have high entropy (at least 45 unique values)
      assert.ok(generated.size >= 45, 'CSPRNG entropy check failed: too many collisions');
    });

    it('should generate secure hex tokens of specified byte lengths', () => {
      const token16 = generateSecureToken(16);
      const token32 = generateSecureToken(32);

      assert.equal(token16.length, 32, '16 bytes must produce 32 hex chars');
      assert.equal(token32.length, 64, '32 bytes must produce 64 hex chars');
      assert.ok(/^[0-9a-f]+$/.test(token32), 'Token must be lowercase hex');
    });
  });

  // --------------------------------------------------------------------------
  // 6. TOTP Multi-Factor Authentication (MFA)
  // --------------------------------------------------------------------------
  describe('6. TOTP Multi-Factor Authentication Setup & Verification', () => {
    it('should generate valid TOTP secret, URI, and verify current code', () => {
      const secret = generateTotpSecret();
      assert.ok(secret.length >= 16, 'TOTP secret should be at least 16 chars base32');

      const email = 'warden.gnbvg@gprec.ac.in';
      const uri = generateTotpUri(email, secret);
      assert.ok(uri.startsWith('otpauth://totp/'), 'URI must have otpauth scheme');
      assert.ok(uri.includes(encodeURIComponent(email)), 'URI must include encoded email');
      assert.ok(
        uri.includes('issuer=GPREC-GNBVG-Hostel') || uri.includes('issuer=GNBVG'),
        'URI must include configured issuer name'
      );

      // Generate a valid TOTP token for this secret
      const validCode = authenticator.generate(secret);
      assert.equal(verifyTotp(validCode, secret), true, 'Valid TOTP code failed verification');

      // Invalid code check
      assert.equal(verifyTotp('000000', secret), false, 'Invalid TOTP code should fail');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Anti-CSRF Token Generation & Verification
  // --------------------------------------------------------------------------
  describe('7. Anti-CSRF Token Validation (Double Submit Cookie)', () => {
    it('should generate and verify matching CSRF tokens timing-safely', () => {
      const token = generateCsrfToken();
      assert.ok(token.length >= 64, 'CSRF token should be at least 64 hex characters');

      // Matching token should pass
      assert.equal(verifyCsrfToken(token, token), true);

      // Mismatched token should fail
      const differentToken = generateCsrfToken();
      assert.equal(verifyCsrfToken(token, differentToken), false);

      // Empty or invalid values should fail
      assert.equal(verifyCsrfToken('', token), false);
      assert.equal(verifyCsrfToken(token, ''), false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Centralized Zod Input Validation & Parent/Guardian Logic
  // --------------------------------------------------------------------------
  describe('8. Zod Validation & Parent/Guardian Conditional Rules', () => {
    const validBody = {
      fullName: 'B. Meghana',
      registrationNumber: '229X1A0412',
      collegeEmail: '229x1a0412@gprec.ac.in',
      password: 'StrongP@ssw0rd!2026',
      academicYear: 2,
      branch: 'ECE',
      section: 'B',
      primaryPhone: '9123456780',
      permanentAddress: 'Flat 301, Sri Krishna Residency, Kurnool',
      blockCode: 'B',
      roomNumber: 'B-205',
    };

    it('should fail registration if neither parent nor guardian is provided', () => {
      const result = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          // no father, mother, or guardian fields
        },
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const hasParentError = result.error.errors.some(e =>
          e.message.includes('Guardian Name, Relationship, and a valid 10-digit Guardian Phone are mandatory')
        );
        assert.ok(hasParentError, 'Must fail with parent/guardian requirement message');
      }
    });

    it('should accept registration when only father details are provided', () => {
      const result = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          fatherName: 'B. Ramana',
          fatherPhone: '9849011223',
        },
      });

      assert.equal(result.success, true);
    });

    it('should accept registration when only mother details are provided', () => {
      const result = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          motherName: 'B. Padmavati',
          motherPhone: '9849033445',
        },
      });

      assert.equal(result.success, true);
    });

    it('should require guardian phone and relation when guardian is provided in place of parents', () => {
      // Guardian name provided without phone & relation
      const resultMissingFields = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          guardianName: 'K. Srinivasa Rao',
        },
      });
      assert.equal(resultMissingFields.success, false);

      // Guardian with full details
      const resultComplete = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          guardianName: 'K. Srinivasa Rao',
          guardianRelation: 'Uncle',
          guardianPhone: '9440123456',
        },
      });
      assert.equal(resultComplete.success, true);
    });

    it('should enforce 10-digit Indian phone numbers starting with [6-9]', () => {
      const invalidPhones = ['1234567890', '98765', '98765432101', 'abcdefghij', '0848012345'];

      for (const phone of invalidPhones) {
        const result = initiateRegistrationSchema.safeParse({
          body: {
            ...validBody,
            fatherName: 'Father Test',
            fatherPhone: phone,
          },
        });
        assert.equal(result.success, false, `Phone ${phone} should have been rejected`);
      }
    });

    it('should enforce valid engineering branches', () => {
      const validBranches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CSM', 'CSD'];
      for (const branch of validBranches) {
        const result = initiateRegistrationSchema.safeParse({
          body: {
            ...validBody,
            branch,
            fatherName: 'Father Test',
            fatherPhone: '9848012345',
          },
        });
        assert.equal(result.success, true, `Branch ${branch} should be valid`);
      }

      // Invalid branch
      const invalidResult = initiateRegistrationSchema.safeParse({
        body: {
          ...validBody,
          branch: 'BIOTECH',
          fatherName: 'Father Test',
          fatherPhone: '9848012345',
        },
      });
      assert.equal(invalidResult.success, false, 'Invalid branch should be rejected');
    });

    it('should validate login credentials schema properly', () => {
      const validLogin = loginSchema.safeParse({
        body: {
          email: 'student@gprec.ac.in',
          password: 'Password123!',
        },
      });
      assert.equal(validLogin.success, true);

      const invalidLogin = loginSchema.safeParse({
        body: {
          email: 'invalid-email',
          password: '',
        },
      });
      assert.equal(invalidLogin.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Role-Based Access Control (RBAC) Middleware
  // --------------------------------------------------------------------------
  describe('9. Role-Based Access Control (RBAC) Enforcement', () => {
    const createMockReqRes = (userRole?: Role) => {
      const req: Partial<Request> = {
        user: userRole
          ? {
              userId: 'test-user-uuid-1234',
              email: 'test@gprec.ac.in',
              role: userRole,
            }
          : undefined,
      };

      const res: Partial<Response> = {};

      let calledNextWith: any = null;
      let nextCalled = false;
      const next: NextFunction = (err?: any) => {
        nextCalled = true;
        calledNextWith = err;
      };

      return {
        req: req as Request,
        res: res as Response,
        next,
        getNextCalled: () => nextCalled,
        getNextError: () => calledNextWith,
      };
    };

    it('should allow student access to student-only endpoint', () => {
      const mock = createMockReqRes(Role.STUDENT);
      requireStudent(mock.req, mock.res, mock.next);

      assert.equal(mock.getNextCalled(), true);
      assert.equal(mock.getNextError(), undefined);
    });

    it('should forbid student from accessing warden or admin endpoints', () => {
      // Student trying to access Warden route
      const mockWarden = createMockReqRes(Role.STUDENT);
      requireWarden(mockWarden.req, mockWarden.res, mockWarden.next);
      assert.equal(mockWarden.getNextCalled(), true);
      const wardenErr = mockWarden.getNextError();
      assert.ok(wardenErr instanceof ForbiddenError, 'Should pass ForbiddenError to next()');
      assert.equal(wardenErr.statusCode, 403);

      // Student trying to access Admin route
      const mockAdmin = createMockReqRes(Role.STUDENT);
      requireAdmin(mockAdmin.req, mockAdmin.res, mockAdmin.next);
      assert.equal(mockAdmin.getNextCalled(), true);
      const adminErr = mockAdmin.getNextError();
      assert.ok(adminErr instanceof ForbiddenError, 'Should pass ForbiddenError to next()');
      assert.equal(adminErr.statusCode, 403);
    });

    it('should allow Admin or Warden to access shared management endpoints', () => {
      // Warden accessing requireWardenOrAdmin
      const mockWarden = createMockReqRes(Role.WARDEN);
      requireWardenOrAdmin(mockWarden.req, mockWarden.res, mockWarden.next);
      assert.equal(mockWarden.getNextCalled(), true);
      assert.equal(mockWarden.getNextError(), undefined);

      // Admin accessing requireWardenOrAdmin
      const mockAdmin = createMockReqRes(Role.ADMIN);
      requireWardenOrAdmin(mockAdmin.req, mockAdmin.res, mockAdmin.next);
      assert.equal(mockAdmin.getNextCalled(), true);
      assert.equal(mockAdmin.getNextError(), undefined);

      // Student accessing requireWardenOrAdmin should be blocked with 403
      const mockStudent = createMockReqRes(Role.STUDENT);
      requireWardenOrAdmin(mockStudent.req, mockStudent.res, mockStudent.next);
      assert.equal(mockStudent.getNextCalled(), true);
      const err = mockStudent.getNextError();
      assert.ok(err instanceof ForbiddenError);
      assert.equal(err.statusCode, 403);
    });

    it('should reject unauthenticated request with 401 Unauthorized', () => {
      const mockUnauth = createMockReqRes(undefined);
      requireStudent(mockUnauth.req, mockUnauth.res, mockUnauth.next);
      assert.equal(mockUnauth.getNextCalled(), true);
      const err = mockUnauth.getNextError();
      assert.ok(err instanceof UnauthorizedError);
      assert.equal(err.statusCode, 401);
    });

    it('should dynamically enforce arbitrary role sets with requireRole()', () => {
      const customRoleChecker = requireRole(Role.WARDEN, Role.ADMIN);
      const mockWarden = createMockReqRes(Role.WARDEN);
      customRoleChecker(mockWarden.req, mockWarden.res, mockWarden.next);
      assert.equal(mockWarden.getNextCalled(), true);
      assert.equal(mockWarden.getNextError(), undefined);

      const mockStudent = createMockReqRes(Role.STUDENT);
      customRoleChecker(mockStudent.req, mockStudent.res, mockStudent.next);
      assert.equal(mockStudent.getNextCalled(), true);
      assert.ok(mockStudent.getNextError() instanceof ForbiddenError);
    });
  });
});
