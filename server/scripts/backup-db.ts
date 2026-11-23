import { createEncryptedBackup } from '../src/utils/backup.js';

createEncryptedBackup().catch((err) => {
  console.error('[BACKUP FATAL ERROR]:', err);
  process.exit(1);
});
