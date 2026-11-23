import sqliteAuthRoutes from '../src/routes/sqliteAuth.routes.js';
import { db, initSqliteDatabase } from '../src/db/sqlite.js';

async function main() {
  await initSqliteDatabase();

  const layer = sqliteAuthRoutes.stack.find((l: any) => l.route?.path === '/verify-student');
  const handler = layer.route.stack[0].handle;

  console.log('--- TEST 1: Lookup Valid Unactivated Student (249XA01002 - B NAGAPRIYANKA) ---');
  const req1: any = { query: { roll_number: '249XA01002' } };
  const res1: any = {
    status(c: number) { this.statusCode = c; return this; },
    json(d: any) { console.log(`HTTP ${this.statusCode}:`, JSON.stringify(d, null, 2)); },
  };
  handler(req1, res1);

  console.log('\n--- TEST 2: Lookup Unauthorized External Roll Number (999XX00000) ---');
  const req2: any = { query: { roll_number: '999XX00000' } };
  const res2: any = {
    status(c: number) { this.statusCode = c; return this; },
    json(d: any) { console.log(`HTTP ${this.statusCode}:`, JSON.stringify(d, null, 2)); },
  };
  handler(req2, res2);
}

main().catch(console.error);
