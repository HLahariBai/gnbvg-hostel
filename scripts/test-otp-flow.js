const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('database/gnbvg.db');

  console.log('====================================================');
  console.log('GNBVG EMAIL OTP & PASSWORD RESET TEST SUITE');
  console.log('====================================================\n');

  const testRoll = '219X1A05393';
  const testStudent = db.prepare('SELECT * FROM users WHERE roll_number = ?').get(testRoll);
  console.log(`Target Resident: ${testStudent.name} (${testStudent.roll_number}, ${testStudent.email})\n`);

  // STEP 1: Request Password Reset OTP
  console.log('--- TEST 1: Request Forgot Password OTP ---');
  const step1 = await postJSON('/api/auth/send-forgot-password-otp', { query: testRoll });
  console.log('Status Code:', step1.statusCode);
  console.log('Response:', JSON.stringify(step1.data));
  const test1Passed = step1.statusCode === 200 && step1.data.success === true;
  console.log('TEST 1 RESULT:', test1Passed ? 'PASSED (Reset OTP Generated & Sent)' : 'FAILED');
  console.log('');

  // Fetch OTP directly from SQLite email_otps table
  const otpRow = db.prepare(`
    SELECT * FROM email_otps
    WHERE roll_number = ? AND purpose = 'forgot_password'
    ORDER BY id DESC LIMIT 1
  `).get(testRoll);
  console.log(`[VERIFICATION] Retrieved Generated OTP from DB: ${otpRow?.otp_code} (Expires: ${new Date(otpRow?.expires_at).toLocaleTimeString()})\n`);

  // STEP 2: Submit Reset Password with Incorrect OTP
  console.log('--- TEST 2: Rejection with Incorrect OTP (000000) ---');
  const step2 = await postJSON('/api/auth/reset-password', {
    email: step1.data.email,
    otp_code: '000000',
    new_password: 'NewSecurePassword@2026',
  });
  console.log('Status Code:', step2.statusCode);
  console.log('Response:', JSON.stringify(step2.data));
  const test2Passed = step2.statusCode === 400 && step2.data.success === false;
  console.log('TEST 2 RESULT:', test2Passed ? 'PASSED (Invalid OTP Blocked)' : 'FAILED');
  console.log('');

  // STEP 3: Submit Reset Password with Correct OTP
  console.log('--- TEST 3: Successful Password Reset with Valid 6-Digit OTP ---');
  const newPassword = 'NewSecurePassword@2026';
  const step3 = await postJSON('/api/auth/reset-password', {
    email: step1.data.email,
    otp_code: otpRow.otp_code,
    new_password: newPassword,
  });
  console.log('Status Code:', step3.statusCode);
  console.log('Response:', JSON.stringify(step3.data));
  const test3Passed = step3.statusCode === 200 && step3.data.success === true;
  console.log('TEST 3 RESULT:', test3Passed ? 'PASSED (Password Updated Successfully)' : 'FAILED');
  console.log('');

  // STEP 4: Login with New Password
  console.log('--- TEST 4: Login Verification with New Password ---');
  const step4 = await postJSON('/api/auth/login', {
    email: testRoll,
    password: newPassword,
  });
  console.log('Status Code:', step4.statusCode);
  console.log('Response:', JSON.stringify(step4.data));
  const test4Passed = step4.statusCode === 200 && step4.data.success === true && step4.data.user.roll_number === testRoll;
  console.log('TEST 4 RESULT:', test4Passed ? 'PASSED (Authenticated with New Password)' : 'FAILED');
  console.log('');

  console.log('====================================================');
  console.log('FINAL SUMMARY:', test1Passed && test2Passed && test3Passed && test4Passed ? 'ALL 4 OTP TESTS PASSED 100%!' : 'SOME TESTS FAILED');
  console.log('====================================================');
}

run().catch(console.error);
