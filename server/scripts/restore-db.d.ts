/**
 * GNBVG Hostel Management System - Encrypted Database Restoration Utility
 * Decrypts and verifies integrity of AES-256-GCM backup archives
 */
export declare function restoreEncryptedBackup(archivePath: string): Promise<Buffer>;
