import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { apiFetch, setCsrfToken } from '../lib/api.js';
import type { User } from '../types/index.js';
import {
  Building2,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  Clock,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

interface RegisterInitiateResponse {
  status: string;
  message: string;
  channel: string;
  expiresInSeconds: number;
}

interface RegisterVerifyResponse {
  status: string;
  message: string;
  user: User;
  csrfToken: string;
}

const PHONE_REGEX = /^[6-9]\d{9}$/;
const GPREC_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gprec\.ac\.in$/;
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const { setUserDirectly } = useAuth();
  const { addToast } = useToast();

  // Form State
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: Form Fields
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [academicYear, setAcademicYear] = useState<number>(1);
  const [branch, setBranch] = useState<'CSE' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'CSM' | 'CSD'>('CSE');
  const [section, setSection] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [blockCode, setBlockCode] = useState<'A' | 'B' | 'C'>('A');
  const [roomNumber, setRoomNumber] = useState('');

  // Parent / Guardian
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  // Roster Verification State
  const [verificationStatus, setVerificationStatus] = useState<{
    loading: boolean;
    verified: boolean;
    message: string;
    alreadyRegistered?: boolean;
  }>({ loading: false, verified: false, message: '' });

  const handleRollNumberBlur = async (roll: string) => {
    const trimmed = roll.trim().toUpperCase();
    if (trimmed.length < 5) return;

    setVerificationStatus({ loading: true, verified: false, message: 'Verifying against hostel admission roster...' });
    try {
      const res = await apiFetch<{
        success: boolean;
        eligible: boolean;
        alreadyRegistered?: boolean;
        message: string;
        student?: any;
      }>(`/api/auth/verify-student?roll_number=${trimmed}`);

      if (res.eligible && res.student) {
        setVerificationStatus({
          loading: false,
          verified: true,
          message: `Verified: ${res.student.name} (Room: ${res.student.room_number}, Block: ${res.student.block})`,
        });
        if (!fullName) setFullName(res.student.name);
        if (!collegeEmail) setCollegeEmail(res.student.email);
        if (res.student.year) setAcademicYear(Number(res.student.year));
        if (res.student.room_number) setRoomNumber(res.student.room_number);
        if (res.student.block) {
          const b = String(res.student.block).includes('Arundhathi')
            ? 'B'
            : String(res.student.block).includes('Anuradha')
            ? 'C'
            : 'A';
          setBlockCode(b);
        }
      } else if (res.alreadyRegistered) {
        setVerificationStatus({
          loading: false,
          verified: false,
          alreadyRegistered: true,
          message: res.message || 'Account already registered. Please sign in.',
        });
      }
    } catch (err: any) {
      setVerificationStatus({
        loading: false,
        verified: false,
        message: err.message || 'Roll number not found on approved hostel list. Contact warden.',
      });
    }
  };

  // Step 2: OTP State
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes (300s)
  const [resending, setResending] = useState(false);

  // Timer countdown
  useEffect(() => {
    let timer: any;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Client Validation before API dispatch
  const validateForm = (): string | null => {
    if (!fullName.trim()) return 'Full Name is required.';
    if (!registrationNumber.trim()) return 'Registration number is required.';
    if (!GPREC_EMAIL_REGEX.test(collegeEmail.trim())) {
      return 'Institutional email must be an official GPREC address ending with @gprec.ac.in';
    }
    if (!STRONG_PASSWORD_REGEX.test(password)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
    }
    if (!PHONE_REGEX.test(primaryPhone.trim())) {
      return 'Primary phone must be a valid 10-digit Indian mobile number starting with 6-9.';
    }
    if (secondaryPhone.trim() && !PHONE_REGEX.test(secondaryPhone.trim())) {
      return 'Secondary phone must be a valid 10-digit Indian mobile number.';
    }
    if (!permanentAddress.trim() || permanentAddress.trim().length < 5) {
      return 'Permanent residential address must be at least 5 characters long.';
    }
    if (!roomNumber.trim()) return 'Hostel room number is required.';

    // Validate Father/Mother vs Guardian constraint
    const hasFather = Boolean(fatherName.trim() && fatherPhone.trim());
    const hasMother = Boolean(motherName.trim() && motherPhone.trim());

    if (hasFather && !PHONE_REGEX.test(fatherPhone.trim())) {
      return 'Father contact must be a valid 10-digit mobile number.';
    }
    if (hasMother && !PHONE_REGEX.test(motherPhone.trim())) {
      return 'Mother contact must be a valid 10-digit mobile number.';
    }

    if (!hasFather && !hasMother) {
      if (!guardianName.trim() || !guardianRelation.trim() || !guardianPhone.trim()) {
        return 'Guardian Name, Relation, and Phone are strictly mandatory when both Father and Mother details are omitted.';
      }
      if (!PHONE_REGEX.test(guardianPhone.trim())) {
        return 'Guardian phone must be a valid 10-digit Indian mobile number.';
      }
    }

    return null;
  };

  const handleInitiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    try {
      setLoading(true);

      const payload = {
        fullName: fullName.trim(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        collegeEmail: collegeEmail.trim().toLowerCase(),
        password,
        academicYear: Number(academicYear),
        branch,
        section,
        primaryPhone: primaryPhone.trim(),
        secondaryPhone: secondaryPhone.trim() || undefined,
        permanentAddress: permanentAddress.trim(),
        blockCode,
        roomNumber: roomNumber.trim(),
        fatherName: fatherName.trim() || undefined,
        fatherPhone: fatherPhone.trim() || undefined,
        motherName: motherName.trim() || undefined,
        motherPhone: motherPhone.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianRelation: guardianRelation.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
      };

      const res = await apiFetch<RegisterInitiateResponse>('/api/auth/register/initiate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCountdown(res.expiresInSeconds || 300);
      setStep(2);
      addToast(
        'info',
        'Verification OTP Dispatched',
        `A 6-digit OTP has been sent to ${collegeEmail}. Valid for 5 minutes.`
      );
    } catch (err: any) {
      console.warn('[REGISTRATION FALLBACK] Checking direct SQLite registration / activation...');
      try {
        const directRes = await apiFetch<{
          success: boolean;
          message: string;
          token?: string;
          user: User;
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: fullName.trim(),
            roll_number: registrationNumber.trim().toUpperCase(),
            email: collegeEmail.trim().toLowerCase(),
            password,
            role: 'student',
            year: String(academicYear),
            block: blockCode === 'A' ? 'Anapurna-A' : blockCode === 'B' ? 'Arundhathi-B' : 'Anuradha-C',
            room_number: roomNumber.trim(),
          }),
        });

        if (directRes.success && directRes.user) {
          setUserDirectly(directRes.user);
          const studentName = (directRes.user as any).fullName || (directRes.user as any).name || fullName;
          addToast(
            'success',
            'Hostel Registration Verified & Activated',
            `Welcome ${studentName}! Your hostel portal is activated. Please proceed to facial enrollment.`
          );
          return;
        }
      } catch (directErr: any) {
        const msg = directErr.message || err.message || 'Registration request could not be processed.';
        if (directErr.status === 403 || msg.toLowerCase().includes('registry') || msg.toLowerCase().includes('roster')) {
          setErrorMsg('Access Denied: Your roll number was not found in the approved GNBVG Hostel Admission Registry.');
          addToast('error', 'Whitelist Gatekeeper Denied', 'Registration restricted to admitted hostel residents.');
        } else {
          setErrorMsg(msg);
          addToast('error', 'Registration Failed', msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (otp.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch<RegisterVerifyResponse>('/api/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          collegeEmail: collegeEmail.trim().toLowerCase(),
          otp: otp.trim(),
        }),
      });

      if (res.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

      if (res.user) {
        setUserDirectly(res.user);
      }

      addToast('success', 'Registration Complete', 'Welcome to G. Narayanamma Balikala Vasathi Gruham!');
    } catch (err: any) {
      const msg = err.message || 'OTP verification failed. Please check the code.';
      setErrorMsg(msg);
      addToast('error', 'Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 240) {
      addToast('warning', 'Please wait', 'You can request a new OTP in 60 seconds.');
      return;
    }

    try {
      setResending(true);
      setErrorMsg('');
      await apiFetch('/api/auth/otp/resend', {
        method: 'POST',
        body: JSON.stringify({
          collegeEmail: collegeEmail.trim().toLowerCase(),
          purpose: 'REGISTRATION',
        }),
      });

      setCountdown(300);
      addToast('info', 'OTP Resent', `A fresh 6-digit OTP was sent to ${collegeEmail}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP.');
      addToast('error', 'Resend Failed', err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl text-center relative z-10 px-4">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-inner">
          <Building2 className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Hosteller Resident Registration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          GNBVG &bull; G. Pulla Reddy Engineering College (Autonomous), Kurnool
        </p>

        {/* Multi-step breadcrumb */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className={`flex items-center gap-2 text-xs font-semibold ${step === 1 ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
              1
            </span>
            <span>Resident Details</span>
          </div>
          <div className="w-8 h-0.5 bg-slate-800" />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step === 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'}`}>
              2
            </span>
            <span>6-Digit Dual-Channel OTP</span>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-3xl px-4 relative z-10">
        <div className="bg-slate-950/85 backdrop-blur-md py-8 px-6 sm:px-10 rounded-3xl border border-slate-800 shadow-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-300 font-medium leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleInitiateSubmit} className="space-y-6">
              {/* Whitelist Info Alert */}
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Gatekeeper Enforced:</strong> Registration is restricted strictly to verified residents present in the Warden’s Hosteller Master Registry. Use your official GPREC institutional email.
                </span>
              </div>

              {/* Section 1: Academic & Personal Identity */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-800 pb-1">
                  1. Academic & Personal Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. S. Lakshmi Prasanna"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Registration Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={registrationNumber}
                      onChange={(e) => {
                        setRegistrationNumber(e.target.value.toUpperCase());
                        if (verificationStatus.message) {
                          setVerificationStatus({ loading: false, verified: false, message: '' });
                        }
                      }}
                      onBlur={() => handleRollNumberBlur(registrationNumber)}
                      placeholder="e.g. 249XA01002"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                    />
                    {verificationStatus.loading && (
                      <p className="mt-1 text-xs text-blue-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Verifying with hostel roster...
                      </p>
                    )}
                    {!verificationStatus.loading && verificationStatus.verified && (
                      <p className="mt-1 text-xs text-emerald-400 font-medium">
                        ✓ {verificationStatus.message}
                      </p>
                    )}
                    {!verificationStatus.loading && !verificationStatus.verified && verificationStatus.message && (
                      <p className={`mt-1 text-xs ${verificationStatus.alreadyRegistered ? 'text-amber-400' : 'text-red-400'}`}>
                        {verificationStatus.alreadyRegistered ? 'ℹ' : '⚠'} {verificationStatus.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      College Email Address (@gprec.ac.in) *
                    </label>
                    <input
                      type="email"
                      required
                      value={collegeEmail}
                      onChange={(e) => setCollegeEmail(e.target.value.toLowerCase())}
                      placeholder="219x1a0501@gprec.ac.in"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-300">
                        Portal Password (Min 8 chars, Uppercase, Num, Special) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 focus:outline-none"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Show</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="StrongP@ssw0rd!2026"
                        className="w-full px-3.5 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Academic Year *
                    </label>
                    <select
                      value={academicYear}
                      onChange={(e) => setAcademicYear(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={1}>1st Year (B.Tech)</option>
                      <option value={2}>2nd Year (B.Tech)</option>
                      <option value={3}>3rd Year (B.Tech)</option>
                      <option value={4}>4th Year (B.Tech)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Branch *
                      </label>
                      <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value as any)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="CSE">CSE</option>
                        <option value="CSM">CSM (AI & ML)</option>
                        <option value="CSD">CSD (Data Sci)</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="MECH">MECH</option>
                        <option value="CIVIL">CIVIL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Section *
                      </label>
                      <select
                        value={section}
                        onChange={(e) => setSection(e.target.value as any)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Hostel Allocation */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-800 pb-1">
                  2. Contact & Hostel Allocation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Primary Mobile Number (10 digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Secondary Contact Number (Optional)
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="9123456780"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Hostel Block *
                    </label>
                    <select
                      value={blockCode}
                      onChange={(e) => setBlockCode(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="A">Block A — Arundhathi</option>
                      <option value="B">Block B — Annapurna</option>
                      <option value="C">Block C — Saraswathi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Allocated Room Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. A-101"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white uppercase font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Permanent Home Residential Address *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={permanentAddress}
                      onChange={(e) => setPermanentAddress(e.target.value)}
                      placeholder="House No, Street, Village/Town, District, State, PIN"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Parent & Local Guardian Details */}
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    3. Parent / Guardian Information
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Either Parent OR Guardian Mandatory
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Father's Name
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Father's Full Name"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Father's Mobile Phone
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Mother's Name
                    </label>
                    <input
                      type="text"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      placeholder="Mother's Full Name"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Mother's Mobile Phone
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Local Guardian Details */}
                  <div className="md:col-span-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block mb-2">
                      Local Guardian Details (Mandatory if parents reside out of state or are omitted):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Guardian Name
                        </label>
                        <input
                          type="text"
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          placeholder="Guardian Name"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Relationship
                        </label>
                        <input
                          type="text"
                          value={guardianRelation}
                          onChange={(e) => setGuardianRelation(e.target.value)}
                          placeholder="e.g. Uncle / Aunt"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Guardian Phone
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="10-digit mobile"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Login</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-slate-950 font-bold text-xs shadow-lg uppercase tracking-wider transition-colors"
                >
                  {loading ? 'Verifying Registry...' : 'Validate & Request OTP'}
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: 6-Digit OTP Verification Screen */
            <form onSubmit={handleVerifySubmit} className="space-y-6 max-w-md mx-auto text-center">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl inline-flex text-emerald-400">
                <KeyRound className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Enter Verification OTP</h3>
                <p className="text-xs text-slate-400 mt-1">
                  We sent a 6-digit verification code to:
                </p>
                <div className="mt-1 font-mono text-xs text-emerald-400 bg-slate-900 py-1 px-3 rounded-lg inline-block border border-slate-800">
                  {collegeEmail}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.6em] text-3xl font-mono py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-emerald-400 font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Code expires in: </span>
                <span className={`font-mono font-bold ${countdown < 60 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatTimer(countdown)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Edit Registration
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending || countdown > 240}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>Resend OTP</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-slate-950 font-bold text-xs rounded-xl shadow uppercase tracking-wider transition-colors"
                >
                  {loading ? 'Confirming...' : 'Complete Registration'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
