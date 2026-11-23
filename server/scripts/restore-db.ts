import { restoreEncryptedBackup } from '../src/utils/backup.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: tsx scripts/restore-db.ts <path-to-encrypted-backup.enc>');
  process.exit(1);
}

restoreEncryptedBackup(target).catch((err) => {
  console.error('[RESTORE FATAL ERROR]:', err);
  process.exit(1);
});
