/**
 * GNBVG Hostel Management System - Encrypted Database Restoration Utility
 * Decrypts and verifies integrity of AES-256-GCM backup archives
 */
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../src/config/env.js';
export async function restoreEncryptedBackup(archivePath) {
    if (!fs.existsSync(archivePath)) {
        throw new Error(`Backup file does not exist: ${archivePath}`);
    }
    console.log(`[RESTORE] Initiating restoration from encrypted archive: ${archivePath}...`);
    const fileBuffer = fs.readFileSync(archivePath);
    // Archive format: [12 bytes IV] [16 bytes AuthTag] [Ciphertext]
    if (fileBuffer.length < 28) {
        throw new Error('Corrupt backup file: insufficient payload length.');
    }
    const iv = fileBuffer.subarray(0, 12);
    const authTag = fileBuffer.subarray(12, 28);
    const ciphertext = fileBuffer.subarray(28);
    const encryptionKey = Buffer.from(env.AES_256_GCM_ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decryptedBuffer;
    try {
        decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
    catch (err) {
        throw new Error('Decryption Failed: Authentication Tag mismatch or incorrect encryption key. Backup may be tampered.');
    }
    // Check against metadata if present
    const metaPath = archivePath.replace(/\.enc$/, '.meta.json');
    if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const actualChecksum = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');
        if (meta.sha256Checksum && meta.sha256Checksum !== actualChecksum) {
            throw new Error(`Integrity Check Failed: Checksum ${actualChecksum} does not match metadata ${meta.sha256Checksum}`);
        }
        console.log(`[RESTORE VERIFIED] SHA-256 checksum matched: ${actualChecksum}`);
    }
    console.log(`[RESTORE SUCCESS] Decrypted ${decryptedBuffer.length} bytes of database records cleanly.`);
    return decryptedBuffer;
}
if (process.argv[1] && process.argv[1].endsWith('restore-db.ts')) {
    const target = process.argv[2];
    if (!target) {
        console.error('Usage: tsx scripts/restore-db.ts <path-to-encrypted-backup.enc>');
        process.exit(1);
    }
    restoreEncryptedBackup(target).catch((err) => {
        console.error('[RESTORE FATAL ERROR]:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=restore-db.js.map