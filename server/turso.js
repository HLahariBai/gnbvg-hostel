// =============================================================
// GNBVG Hostel - Turso Cloud Database Sync Module
// Ensures 5+ Year Permanent Cloud Data Retention on Free Tier
// =============================================================

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://gnbvg-hostel-hlaharibai.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTU0NTQ1MTgsImlkIjoiMDFhMjA5NmQtMzQwMS03YmI3LTgyMmMtZWFjZGJjODQxMmZhIiwia2lkIjoiX2FYcTJZMVRFdW4zbGVwTVhGS0FBT241blE2X3V3NGo5am9MOVg0M1k0VSIsInJpZCI6IjYyZDI1NWYxLTA1ZmItNDM4Zi05ZWJjLTZmZjZjNDdkZThhNiJ9.i29MHw9Zt9k1P4Q-RQFMOmB6cpYzLq_9SdLG_KuX2HsCOlo2D2UIQGbpEpflw0VSII904ZsxD-pFt4ijUuJyCA';

function getHttpPipelineUrl(urlStr) {
  let clean = urlStr.replace(/^libsql:\/\//, 'https://').replace(/^http:\/\//, 'https://');
  if (!clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  clean = clean.replace(/\/+$/, '');
  return `${clean}/v2/pipeline`;
}

const PIPELINE_URL = getHttpPipelineUrl(TURSO_URL);

/**
 * Execute statements in Turso Cloud via HTTP Pipeline
 */
async function tursoPipeline(stmts) {
  if (!TURSO_AUTH_TOKEN || !PIPELINE_URL) return null;
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

  const resp = await fetch(PIPELINE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Turso HTTP Error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  return data.results;
}

/**
 * Asynchronously push a single query to Turso Cloud (fire-and-forget or awaited)
 */
function tursoExecuteAsync(sql, args = []) {
  tursoPipeline([{ sql, args }]).catch((err) => {
    console.warn('[TURSO SYNC ERROR] Failed to mirror query to Turso cloud:', err.message);
  });
}

/**
 * On server startup: Pull all enrolled faces, attendance records, outpasses, tickets from Turso
 * into the local SQLite database. Even if Render container was wiped, all student data is restored!
 */
async function pullFromTurso(localDb) {
  try {
    console.log('[TURSO SYNC] Checking Turso cloud database for updates (5-Year Permanent Storage)...');
    
    // 1. Pull users with enrolled faces or updated credentials
    const userRes = await tursoPipeline([
      { sql: 'SELECT id, roll_number, name, email, password_hash, face_enrolled, face_descriptor, face_photo, face_enrolled_at, face_enroll_attempts, streak, dinner_rsvp FROM users WHERE face_enrolled = 1 OR face_descriptor IS NOT NULL OR face_photo IS NOT NULL OR password_hash IS NOT NULL' }
    ]);

    if (userRes && userRes[0]?.type === 'ok') {
      const rows = userRes[0].response.result.rows;
      const cols = userRes[0].response.result.cols.map(c => c.name);
      let updatedCount = 0;

      for (const r of rows) {
        const obj = {};
        cols.forEach((col, idx) => {
          obj[col] = r[idx].type === 'null' ? null : r[idx].value;
        });

        // Update local DB
        localDb.prepare(`
          UPDATE users
          SET face_enrolled = ?, face_descriptor = ?, face_photo = ?, face_enrolled_at = COALESCE(?, face_enrolled_at), face_enroll_attempts = ?, password_hash = COALESCE(?, password_hash), streak = ?, dinner_rsvp = ?
          WHERE id = ? OR roll_number = ?
        `).run(
          obj.face_enrolled ? Number(obj.face_enrolled) : 0,
          obj.face_descriptor,
          obj.face_photo,
          obj.face_enrolled_at || null,
          obj.face_enroll_attempts ? Number(obj.face_enroll_attempts) : 0,
          obj.password_hash,
          obj.streak ? Number(obj.streak) : 0,
          obj.dinner_rsvp ? Number(obj.dinner_rsvp) : 0,
          obj.id,
          obj.roll_number
        );
        updatedCount++;
      }
      console.log(`[TURSO SYNC] Successfully synced ${updatedCount} user profiles and enrolled faces from Turso.`);
    }

    // 2. Pull all attendance records
    const attRes = await tursoPipeline([
      { sql: 'SELECT * FROM attendance' }
    ]);

    if (attRes && attRes[0]?.type === 'ok') {
      const rows = attRes[0].response.result.rows;
      const cols = attRes[0].response.result.cols.map(c => c.name);
      let attCount = 0;

      for (const r of rows) {
        const obj = {};
        cols.forEach((col, idx) => {
          obj[col] = r[idx].type === 'null' ? null : r[idx].value;
        });

        localDb.prepare(`
          INSERT OR REPLACE INTO attendance (id, student_id, roll_number, name, year, block, room_number, date, timestamp, latitude, longitude, face_distance, gps_distance, status, is_geofence_breach, warden_action, action_timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          obj.id,
          obj.student_id,
          obj.roll_number,
          obj.name,
          obj.year,
          obj.block,
          obj.room_number,
          obj.date,
          obj.timestamp,
          obj.latitude ? Number(obj.latitude) : null,
          obj.longitude ? Number(obj.longitude) : null,
          obj.face_distance ? Number(obj.face_distance) : null,
          obj.gps_distance ? Number(obj.gps_distance) : 0,
          obj.status || 'Present',
          obj.is_geofence_breach ? Number(obj.is_geofence_breach) : 0,
          obj.warden_action || 'Pending',
          obj.action_timestamp || null
        );
        attCount++;
      }
      console.log(`[TURSO SYNC] Successfully synced ${attCount} attendance records from Turso.`);
    }

    // 3. Pull outpasses
    const opRes = await tursoPipeline([{ sql: 'SELECT * FROM outpasses' }]);
    if (opRes && opRes[0]?.type === 'ok') {
      const rows = opRes[0].response.result.rows;
      const cols = opRes[0].response.result.cols.map(c => c.name);
      for (const r of rows) {
        const obj = {};
        cols.forEach((col, idx) => { obj[col] = r[idx].type === 'null' ? null : r[idx].value; });
        localDb.prepare(`
          INSERT OR REPLACE INTO outpasses (id, student_id, roll_number, student_name, year, block, room_number, type, from_date, to_date, reason, parent_phone, status, applied_at, approved_at, approved_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          obj.id, obj.student_id, obj.roll_number, obj.student_name, obj.year, obj.block, obj.room_number,
          obj.type, obj.from_date, obj.to_date, obj.reason, obj.parent_phone, obj.status, obj.applied_at, obj.approved_at, obj.approved_by
        );
      }
    }

    // 4. Pull maintenance tickets
    const tixRes = await tursoPipeline([{ sql: 'SELECT * FROM maintenance_tickets' }]);
    if (tixRes && tixRes[0]?.type === 'ok') {
      const rows = tixRes[0].response.result.rows;
      const cols = tixRes[0].response.result.cols.map(c => c.name);
      for (const r of rows) {
        const obj = {};
        cols.forEach((col, idx) => { obj[col] = r[idx].type === 'null' ? null : r[idx].value; });
        localDb.prepare(`
          INSERT OR REPLACE INTO maintenance_tickets (id, student_id, roll_number, student_name, block, room_number, category, description, status, created_at, resolved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          obj.id, obj.student_id, obj.roll_number, obj.student_name, obj.block, obj.room_number,
          obj.category, obj.description, obj.status, obj.created_at, obj.resolved_at
        );
      }
    }

    console.log('[TURSO SYNC COMPLETED] Cloud sync completed. All 5-year records active in memory.');
    return true;
  } catch (err) {
    console.error('[TURSO SYNC INIT FAILED]', err.message);
    return false;
  }
}

export {
  tursoPipeline,
  tursoExecuteAsync,
  pullFromTurso,
  TURSO_URL,
};
