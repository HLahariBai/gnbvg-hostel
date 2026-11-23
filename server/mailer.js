try { process.loadEnvFile(); } catch {}
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nodemailer = require('./node_modules/nodemailer');

// Configure SMTP credentials (can be set in .env or defaults)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || `"GNBVG Hostel (GPREC Kurnool)" <${SMTP_USER || 'no-reply@gprec.ac.in'}>`;

let transporter = null;
if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log(`[MAILER] SMTP Transport configured for ${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT}`);
} else {
  console.log('[MAILER] Live SMTP credentials not set. OTPs will be securely logged and verified locally.');
}

/**
 * Send 6-Digit OTP Email to student
 */
export async function sendOtpEmail({ toEmail, studentName, rollNumber, otpCode, purpose }) {
  const isForgot = purpose === 'forgot_password';
  const subject = isForgot
    ? `[GNBVG Hostel] Password Reset OTP: ${otpCode}`
    : `[GNBVG Hostel] Registration Verification OTP: ${otpCode}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #fee2e2; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #FF5A36, #F59E0B); padding: 28px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">GNBVG Hostel</h1>
        <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; opacity: 0.95;">G. Narayanamma Balikala Vasathi Gruham • GPREC Kurnool</p>
      </div>
      <div style="padding: 32px 28px; color: #334155;">
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">
          ${isForgot ? 'Password Reset Request' : 'Student Account Verification'}
        </h2>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #475569;">
          Hello <strong>${studentName || 'Resident'}</strong> (${rollNumber || 'Student'}),<br/>
          ${
            isForgot
              ? 'You requested a password reset for your GNBVG Hostel Portal account.'
              : 'Please verify your college institutional email to complete your GNBVG hostel portal registration.'
          }
        </p>

        <div style="background: #fff7ed; border: 2px dashed #ffedd5; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="display: block; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #ea580c; margin-bottom: 8px;">
            Your 6-Digit One-Time Password (OTP)
          </span>
          <span style="font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #c2410c;">
            ${otpCode}
          </span>
          <span style="display: block; font-size: 12px; color: #9a3412; margin-top: 8px;">
            Valid for the next 10 minutes. Do not share this OTP with anyone.
          </span>
        </div>

        <p style="font-size: 12px; color: #64748b; margin: 24px 0 0; line-height: 1.5;">
          If you did not request this verification code, please ignore this email or notify your block warden immediately.
        </p>
      </div>
      <div style="background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
        G. Pulla Reddy Engineering College (Autonomous), Kurnool • GNBVG Residence Office
      </div>
    </div>
  `;

  console.log(`[EMAIL OTP] Purpose: ${purpose} | To: ${toEmail} (${rollNumber}) | OTP: ${otpCode}`);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        html,
      });
      console.log(`[MAILER SUCCESS] Message sent to ${toEmail}: ${info.messageId}`);
      return { sent: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[MAILER ERROR] Failed to send via SMTP:`, err.message);
      return { sent: false, error: err.message, fallbackLogged: true };
    }
  }

  return { sent: true, mode: 'local_simulation', otpCode };
}
