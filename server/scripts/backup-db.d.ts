/**
 * GNBVG Hostel Management System - Encrypted Database Backup Utility
 * Standard: AES-256-GCM with SHA-256 Checksum and 12-byte random IV
 */
export declare function createEncryptedBackup(targetDir?: string): Promise<string>;
