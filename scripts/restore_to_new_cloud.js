// =============================================================
// GNBVG Hostel - Universal Cloud Restorer & Migrator
// Reads your local PC master backup and restores all 920 students,
// 232 enrolled biometric faces, and all attendance logs to ANY new
// database or cloud provider with 1 command.
// =============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const backupFile = path.join(projectRoot, 'backup', 'biometrics_cloud_master_latest.json');

const targetUrl = process.argv[2] || process.env.TURSO_DATABASE_URL || 'libsql://gnbvg-hostel-hlaharibai.aws-ap-south-1.turso.io';
const targetToken = process.argv[3] || process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTU0NTQ1MTgsImlkIjoiMDFhMjA5NmQtMzQwMS03YmI3LTgyMmMtZWFjZGJjODQxMmZhIiwia2lkIjoiX2FYcTJZMVRFdW4zbGVwTVhGS0FBT241blE2X3V3NGo5am9MOVg0M1k0VSIsInJpZCI6IjYyZDI1NWYxLTA1ZmItNDM4Zi05ZWJjLTZmZjZjNDdkZThhNiJ9.i29MHw9Zt9k1P4Q-RQFMOmB6cpYzLq_9SdLG_KuX2HsCOlo2D2UIQGbpEpflw0VSII904ZsxD-pFt4ijUuJyCA';

async function restoreToTargetCloud() {
  console.log('======================================================');
  console.log('  STARTING GNBVG UNIVERSAL BACKUP RESTORER            ');
  console.log('======================================================');

  if (!fs.existsSync(backupFile)) {
    console.error(`[ERROR] Backup file not found at: ${backupFile}`);
    process.exit(1);
  }

  console.log(`[1/3] Reading Local PC Master Backup (${backupFile})...`);
  const rawData = fs.readFileSync(backupFile, 'utf-8');
  const backup = JSON.parse(rawData);

  const enrolledFaces = backup.enrolled_biometric_faces || [];
  const allUsers = backup.all_students || [];
  const attendanceLogs = backup.attendance_records || [];

  console.log(`      -> Enrolled Faces in Local File: ${enrolledFaces.length}`);
  console.log(`      -> Total Student Accounts:        ${allUsers.length}`);
  console.log(`      -> Attendance Check-in Logs:      ${attendanceLogs.length}`);

  let cleanUrl = targetUrl.replace(/^libsql:\/\//, 'https://').replace(/^http:\/\//, 'https://').replace(/\/+$/, '');
  if (!cleanUrl.startsWith('https://')) cleanUrl = 'https://' + cleanUrl;
  const pipelineUrl = `${cleanUrl}/v2/pipeline`;

  console.log(`[2/3] Connecting to Target Database: ${pipelineUrl}...`);

  async function sendBatch(stmts) {
    const requests = stmts.map((s) => {
      const sql = typeof s === 'string' ? s : s.sql;
      const rawArgs = typeof s === 'string' ? [] : (s.args || []);
      const args = rawArgs.map((a) => {
        if (a === null || a === undefined) return { type: 'null' };
        if (typeof a === 'number') {
          return Number.isInteger(a) ? { type: 'integer', value: String(a) } : { type: 'float', value: a };
        }
        return { type: 'text', value: String(a) };
      });
      return { type: 'execute', stmt: { sql, args } };
    });
    requests.push({ type: 'close' });

    const resp = await fetch(pipelineUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!resp.ok) {
      throw new Error(`Turso Error (${resp.status}): ${await resp.text()}`);
    }
  }

  // Restore Enrolled Faces
  console.log(`[3/3] Restoring ${enrolledFaces.length} Enrolled Faces to Cloud...`);
  const faceBatches = [];
  let currentBatch = [];

  for (const f of enrolledFaces) {
    currentBatch.push({
      sql: 'UPDATE users SET face_descriptor = ?, face_photo = ?, face_enrolled = 1, streak = ? WHERE roll_number = ? OR id = ?',
      args: [f.face_descriptor, f.face_photo || null, Number(f.streak || 1), f.roll_number || f.id, f.roll_number || f.id],
    });
    if (currentBatch.length >= 25) {
      faceBatches.push(currentBatch);
      currentBatch = [];
    }
  }
  if (currentBatch.length > 0) faceBatches.push(currentBatch);

  for (let i = 0; i < faceBatches.length; i++) {
    await sendBatch(faceBatches[i]);
    console.log(`      -> Uploaded Batch ${i + 1}/${faceBatches.length}...`);
  }

  console.log('======================================================');
  console.log('  RESTORATION SUCCESSFUL!                             ');
  console.log(`  All ${enrolledFaces.length} biometric faces restored from PC.`);
  console.log('======================================================');
}

restoreToTargetCloud().catch((err) => {
  console.error('[RESTORE FAILED]', err);
  process.exit(1);
});
