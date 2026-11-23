import crypto from 'crypto';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';

// ==============================================================================
// 1. ARGON2id PASSWORD HASHING
// ==============================================================================

/**
 * Recommended production Argon2id options:
 * - type: Argon2id (hybrid defense against side-channel and GPU cracking)
 * - memoryCost: 64 MB (65536 KiB)
 * - timeCost: 3 iterations
 * - parallelism: 1 thread
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch (error) {
    console.error('[CRYPTO] Argon2 verification failure:', error);
    return false;
  }
}

// ==============================================================================
// 2. CRYPTOGRAPHICALLY SECURE RANDOM NUMBER GENERATION (CSPRNG)
// ==============================================================================

/**
 * Generates a cryptographically secure random hexadecimal token.
 * Defaults to 32 bytes (64 hex characters).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Generates a cryptographically secure numeric OTP of the specified length.
 * Uses rejection sampling to prevent modulo bias.
 */
export function generateCryptoNumericOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length * 2);

  let byteIdx = 0;
  while (otp.length < length) {
    if (byteIdx >= randomBytes.length) {
      const freshBytes = crypto.randomBytes(length);
      for (let i = 0; i < freshBytes.length && otp.length < length; i++) {
        const val = freshBytes[i];
        if (val < 250) {
          otp += digits[val % 10];
        }
      }
      break;
    }
    const val = randomBytes[byteIdx++];
    if (val < 250) {
      otp += digits[val % 10];
    }
  }

  // Fallback guarantee if length was not met
  while (otp.length < length) {
    otp += Math.floor(Math.random() * 10).toString();
  }

  return otp;
}

/**
 * Generates a SHA-256 hash of arbitrary text (e.g. for OTP verification or template indexing).
 */
export function hashSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ==============================================================================
// 3. FIELD-LEVEL AES-256-GCM ENCRYPTION & DECRYPTION
// ==============================================================================

const AES_KEY = Buffer.from(env.AES_256_GCM_ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  combined: string;
}

/**
 * Encrypts a string using AES-256-GCM with a fresh random 96-bit IV.
 * Returns both component representations and a combined string: "iv:authTag:ciphertext".
 */
export function encryptAesGcm(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const ivHex = iv.toString('hex');
  const tagHex = authTag.toString('hex');
  const cipherHex = encrypted.toString('hex');

  return {
    iv: ivHex,
    authTag: tagHex,
    ciphertext: cipherHex,
    combined: `${ivHex}:${tagHex}:${cipherHex}`,
  };
}

/**
 * Decrypts an AES-256-GCM payload.
 * Accepts either the combined format "iv:authTag:ciphertext" or an object.
 * Throws an error if the authentication tag verification fails (detecting tampering).
 */
export function decryptAesGcm(
  input: string | { ciphertext: string; iv: string; authTag: string }
): string {
  let ivHex: string;
  let tagHex: string;
  let cipherHex: string;

  if (typeof input === 'string') {
    const parts = input.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid AES-GCM combined payload format. Expected "iv:authTag:ciphertext"');
    }
    [ivHex, tagHex, cipherHex] = parts;
  } else {
    ivHex = input.iv;
    tagHex = input.authTag;
    cipherHex = input.ciphertext;
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ==============================================================================
// 4. HMAC-SHA-256 INTEGRITY & SIGNING
// ==============================================================================

/**
 * Creates an HMAC-SHA-256 signature for message integrity or QR code verification.
 */
export function generateHmac(data: string, secret = env.HMAC_SECRET): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies an HMAC-SHA-256 signature using a timing-safe equality comparison.
 */
export function verifyHmac(data: string, signature: string, secret = env.HMAC_SECRET): boolean {
  const expected = generateHmac(data, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// ==============================================================================
// 5. TOTP MULTI-FACTOR AUTHENTICATION (MFA)
// ==============================================================================

authenticator.options = {
  window: 1, // Allow 1 step before/after (90-second total window) for clock drift
  step: 30,  // Standard 30-second token lifetime
  digits: 6, // Standard 6-digit TOTP
};

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20); // 160-bit secret
}

export function generateTotpUri(userEmail: string, secret: string): string {
  return authenticator.keyuri(userEmail, env.TOTP_SERVICE_NAME, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch (err) {
    console.error('[TOTP] Verification error:', err);
    return false;
  }
}

// ==============================================================================
// 6. ANTI-CSRF TOKEN GENERATION & VALIDATION
// ==============================================================================

/**
 * Generates an anti-CSRF token comprising 32 random bytes + timestamp + HMAC signature.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const payload = `${nonce}.${timestamp}`;
  const sig = crypto.createHmac('sha256', env.HMAC_SECRET).update(payload).digest('hex').slice(0, 32);
  return `${payload}.${sig}`;
}

/**
 * Verifies an anti-CSRF token format, expiration (24h max), and cryptographic signature.
 */
export function verifyCsrfToken(cookieToken?: string, headerToken?: string): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Double Submit Cookie pattern: cookie value and header value must match
  if (cookieToken !== headerToken) {
    return false;
  }

  const parts = headerToken.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [nonce, timestampStr, signature] = parts;
  const payload = `${nonce}.${timestampStr}`;
  const expectedSig = crypto.createHmac('sha256', env.HMAC_SECRET).update(payload).digest('hex').slice(0, 32);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  // Verify expiry (24 hours max)
  const timestamp = parseInt(timestampStr, 36);
  const ageMs = Date.now() - timestamp;
  if (ageMs > 24 * 60 * 60 * 1000 || ageMs < -60000) {
    return false;
  }

  return true;
}
