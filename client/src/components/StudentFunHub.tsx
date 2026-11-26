import React, { useEffect, useState } from 'react';
import { Award, Clock, Flame, PartyPopper, Sparkles, Trophy, Utensils, Zap } from 'lucide-react';
import { fireFestiveConfetti, playPopSound } from '../utils/celebration';

export interface StudentFunHubProps {
  student: {
    id: string;
    roll_number?: string;
    name: string;
    block: string;
    streak: number;
    dinnerRsvp: boolean;
  };
  isFaceEnrolled: boolean;
  todayAttendanceStatus: { status: string; timestamp?: string } | null;
  myAttendanceLogs: any[];
  allStudents: any[];
  attendanceRecords: any[];
  todayStr: string;
  frsStartTime: string;
  frsEndTime: string;
  windowIsOpen: boolean;
  onToggleDinnerRsvp: (nextVal: boolean) => Promise<void>;
  isUpdatingRsvp: boolean;
  onShowToast: (title: string, message: string, type?: 'success' | 'error' | 'warning') => void;
}

interface TierInfo {
  label: string;
  badgeClass: string;
  barClass: string;
  nextXp: number;
  maxed: boolean;
}

function getTierInfo(xp: number): TierInfo {
  if (xp < 200) {
    return {
      label: '🌱 Rising Fresher',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      barClass: 'from-emerald-400 via-teal-500 to-cyan-500',
      nextXp: 200,
      maxed: false,
    };
  }
  if (xp < 500) {
    return {
      label: '⚡ Star Resident',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
      barClass: 'from-cyan-500 via-blue-500 to-violet-500',
      nextXp: 500,
      maxed: false,
    };
  }
  if (xp < 1000) {
    return {
      label: '🌟 Golden Hosteler',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      barClass: 'from-amber-400 via-orange-500 to-pink-500',
      nextXp: 1000,
      maxed: false,
    };
  }
  return {
    label: '👑 Hostel Legend',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    barClass: 'from-fuchsia-500 via-purple-500 to-amber-400',
    nextXp: 1000,
    maxed: true,
  };
}

const VIBE_OPTIONS = [
  {
    id: 'productive',
    emoji: '🚀',
    label: 'Productive',
    quote: 'Laser focused today! Keep crushing those goals at GPREC 🚀✨',
    activeClass: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white border-sky-400 shadow-md shadow-sky-500/25 scale-105',
  },
  {
    id: 'exam',
    emoji: '📚',
    label: 'Exam Mode',
    quote: "You've got this! Ace those GPREC exams — remember to hydrate & dine 📚💪",
    activeClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-violet-400 shadow-md shadow-violet-500/25 scale-105',
  },
  {
    id: 'chill',
    emoji: '☕',
    label: 'Chill Vibes',
    quote: 'Evening breeze in the GNBVG courtyard hits different ☕🌿',
    activeClass: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-teal-400 shadow-md shadow-teal-500/25 scale-105',
  },
  {
    id: 'fun',
    emoji: '🎉',
    label: 'Hostel Fun',
    quote: 'Making unforgettable hostel memories with the wing squad 🎉💖',
    activeClass: 'bg-gradient-to-br from-coral to-pink-600 text-white border-rose-400 shadow-md shadow-coral/25 scale-105',
  },
  {
    id: 'sleepy',
    emoji: '😴',
    label: 'Sleepy',
    quote: 'Quick FRS scan, warm mess dinner, and cozy sleep ahead 😴🌙',
    activeClass: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-400 shadow-md shadow-amber-500/25 scale-105',
  },
] as const;

const BLOCK_ORDER = [
  { id: 'Anapurna-A', barClass: 'from-coral via-orange-500 to-amber-400' },
  { id: 'Arundhathi-B', barClass: 'from-teal-500 via-emerald-500 to-cyan-400' },
  { id: 'Anuradha-C', barClass: 'from-indigo-500 via-violet-500 to-fuchsia-500' },
] as const;

function parseHHMMToSeconds(hhmm: string, fallbackHours: number): number {
  const parts = String(hhmm || '').split(':').map(Number);
  const h = Number.isFinite(parts[0]) ? parts[0] : fallbackHours;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  return h * 3600 + m * 60;
}

function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}

function getISTClockStatus(frsStartTime: string, frsEndTime: string, windowIsOpen: boolean) {
  const now = new Date();
  const timeText = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const curH = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
  const curM = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const curS = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
  const curSec = curH * 3600 + curM * 60 + curS;

  const frsStartSec = parseHHMMToSeconds(frsStartTime, 17);
  const frsEndSec = parseHHMMToSeconds(frsEndTime, 19);
  const dinnerStartSec = 19 * 3600 + 30 * 60; // 07:30 PM
  const dinnerEndSec = 21 * 3600; // 09:00 PM

  let headline = '';
  if (curSec < frsStartSec) {
    headline = `FRS Window opens in ${formatDurationHMS(frsStartSec - curSec)}`;
  } else if (windowIsOpen && curSec <= frsEndSec) {
    headline = `FRS LIVE! Closes in ${formatDurationHMS(frsEndSec - curSec)}`;
  } else if (curSec < dinnerStartSec) {
    headline = `Mess Dinner opens in ${formatDurationHMS(dinnerStartSec - curSec)}`;
  } else if (curSec <= dinnerEndSec) {
    headline = `🍽️ Mess Dinner is LIVE! Closes in ${formatDurationHMS(dinnerEndSec - curSec)}`;
  } else {
    headline = `Goodnight GNBVG! Next FRS tomorrow ${frsStartTime || '17:00'} IST`;
  }

  return { timeText, headline };
}

function isEarlyBirdTimestamp(ts?: string): boolean {
  if (!ts) return false;
  const m = String(ts).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!m) return false;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = (m[3] || '').toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h === 17 && min <= 30;
}

export const StudentFunHub: React.FC<StudentFunHubProps> = ({
  student,
  isFaceEnrolled,
  todayAttendanceStatus,
  myAttendanceLogs,
  allStudents,
  attendanceRecords,
  todayStr,
  frsStartTime,
  frsEndTime,
  windowIsOpen,
  onToggleDinnerRsvp,
  isUpdatingRsvp,
  onShowToast,
}) => {
  const vibeKey = `gnbvg_vibe_${student.id}_${todayStr}`;
  const [selectedVibe, setSelectedVibe] = useState<string>(() => {
    try {
      return localStorage.getItem(vibeKey) || 'productive';
    } catch {
      return 'productive';
    }
  });
  const [clock, setClock] = useState(() => getISTClockStatus(frsStartTime, frsEndTime, windowIsOpen));

  useEffect(() => {
    try {
      setSelectedVibe(localStorage.getItem(vibeKey) || 'productive');
    } catch {
      setSelectedVibe('productive');
    }
  }, [vibeKey]);

  useEffect(() => {
    setClock(getISTClockStatus(frsStartTime, frsEndTime, windowIsOpen));
    const timer = setInterval(() => {
      setClock(getISTClockStatus(frsStartTime, frsEndTime, windowIsOpen));
    }, 1000);
    return () => clearInterval(timer);
  }, [frsStartTime, frsEndTime, windowIsOpen]);

  const presentLogs = myAttendanceLogs.filter((r) => String(r.status).includes('Present'));
  const isPresentToday = Boolean(todayAttendanceStatus?.status?.includes('Present'));
  const totalPresentDays = Math.max(student.streak || 0, presentLogs.length);
  const xp = totalPresentDays * 50 + (isFaceEnrolled ? 100 : 0) + (isPresentToday ? 50 : 0);
  const tier = getTierInfo(xp);
  const progressPct = tier.maxed ? 100 : Math.min(100, Math.round((xp / tier.nextXp) * 100));

  const hasEarlyBird =
    isEarlyBirdTimestamp(todayAttendanceStatus?.timestamp) ||
    presentLogs.some((r) => isEarlyBirdTimestamp(r.timestamp));
  const hasCourtyardMaster =
    isPresentToday || presentLogs.some((r) => !r.is_geofence_breach);

  const badges = [
    {
      id: 'pioneer',
      icon: '🛡️',
      title: 'Biometric Pioneer',
      unlocked: isFaceEnrolled,
      hint: 'Complete Step 1 Face Enrollment to unlock this shield!',
      unlockedClass: 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-900',
    },
    {
      id: 'early-bird',
      icon: '🌅',
      title: 'Early Bird',
      unlocked: hasEarlyBird,
      hint: 'Check in between 05:00 PM and 05:30 PM IST to unlock!',
      unlockedClass: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-900',
    },
    {
      id: 'courtyard',
      icon: '📍',
      title: 'Courtyard Master',
      unlocked: hasCourtyardMaster,
      hint: 'Record an attendance inside the hostel GPS courtyard!',
      unlockedClass: 'bg-gradient-to-r from-cyan-50 to-sky-50 border-cyan-300 text-sky-900',
    },
    {
      id: 'streak-spark',
      icon: '🔥',
      title: 'Streak Spark',
      unlocked: totalPresentDays >= 3,
      hint: `Reach a 3-day check-in streak (${totalPresentDays}/3 days so far)!`,
      unlockedClass: 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-300 text-rose-900',
    },
    {
      id: 'checked-today',
      icon: '✅',
      title: 'Checked-In Today',
      unlocked: isPresentToday,
      hint: "Complete today's FRS attendance check-in to light up this badge!",
      unlockedClass: 'bg-gradient-to-r from-violet-50 to-fuchsia-50 border-violet-300 text-violet-900',
    },
  ];

  // Inter-Block Leaderboard (today's check-in rate if active, else FRS Readiness %)
  const todayPresentCountAll = attendanceRecords.filter(
    (a) => a.date === todayStr && String(a.status).includes('Present')
  ).length;
  const leaderboardMode: 'attendance' | 'readiness' = todayPresentCountAll > 0 ? 'attendance' : 'readiness';

  const blockStats = BLOCK_ORDER.map((blk) => {
    const members = allStudents.filter((s) => s.block === blk.id);
    const total = members.length;
    const count =
      leaderboardMode === 'attendance'
        ? members.filter((s) =>
            attendanceRecords.some(
              (a) => (a.studentId === s.id || a.studentId === s.roll_number) && a.date === todayStr
            )
          ).length
        : members.filter((s) => Boolean(s.faceEnrolled || Number(s.face_enrolled) === 1 || s.face_photo)).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { ...blk, total, count, pct };
  }).sort((a, b) => b.pct - a.pct);

  const activeVibe = VIBE_OPTIONS.find((v) => v.id === selectedVibe) || VIBE_OPTIONS[0];

  const handleSelectVibe = (vibe: (typeof VIBE_OPTIONS)[number]) => {
    setSelectedVibe(vibe.id);
    try {
      localStorage.setItem(vibeKey, vibe.id);
    } catch {}
    playPopSound();
    onShowToast(`${vibe.emoji} Mood Updated`, vibe.quote);
  };

  const handleBadgeTap = (b: (typeof badges)[number]) => {
    playPopSound();
    if (b.unlocked) {
      fireFestiveConfetti('mini');
      onShowToast(`${b.icon} ${b.title} Unlocked!`, `Awesome job, ${student.name.split(' ')[0]}! Keep shining at GNBVG.`);
    } else {
      onShowToast(`${b.icon} ${b.title} (Locked)`, b.hint, 'warning');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. GAMIFIED STREAK, XP TIER & BADGES BAR */}
      <div className="rounded-3xl bg-white/95 backdrop-blur-md p-5 sm:p-6 shadow-lg border-2 border-purple-100 relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-coral via-amber-400 via-emerald-400 to-violet-500 animate-gradient-x absolute top-0 left-0 right-0" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/25">
              <span className="flame-flicker text-xl leading-none">
                <Flame className="w-5 h-5 fill-amber-300 text-amber-200" />
              </span>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-orange-100 leading-none">Active Streak</div>
                <div className="font-display font-extrabold text-base leading-tight">
                  {totalPresentDays} {totalPresentDays === 1 ? 'Day' : 'Days'} 🔥
                </div>
              </div>
            </div>

            <span className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold border shadow-xs ${tier.badgeClass}`}>
              {tier.label}
            </span>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-extrabold">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>{xp} XP</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 lg:max-w-md">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                <span>Level Progress</span>
                <span className="font-mono text-indigo-700">
                  {tier.maxed ? 'MAX LEVEL ACHIEVED 🎉' : `${xp} / ${tier.nextXp} XP`}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/70">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${tier.barClass} transition-all duration-700`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playPopSound();
                fireFestiveConfetti('mini');
              }}
              className="shimmer-btn px-3.5 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-xs font-extrabold shadow-md shadow-fuchsia-500/20 flex items-center justify-center gap-1.5 transition hover:-translate-y-0.5 shrink-0"
            >
              <PartyPopper className="w-4 h-4" />
              <span>Pop Confetti</span>
            </button>
          </div>
        </div>

        {/* Interactive Achievement Badges Shelf */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-coral" />
              <span>Resident Achievement Badges (Tap any badge!)</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700">
              {badges.filter((b) => b.unlocked).length}/{badges.length} Unlocked
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleBadgeTap(b)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold border flex items-center gap-1.5 transition transform hover:-translate-y-0.5 ${
                  b.unlocked
                    ? `${b.unlockedClass} shadow-xs`
                    : 'bg-slate-50 border-slate-200 text-slate-400 opacity-75 hover:opacity-100'
                }`}
              >
                <span className={b.unlocked ? '' : 'grayscale'}>{b.icon}</span>
                <span>{b.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 3-COLUMN INTERACTIVE CAMPUS LIFE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Mess Dinner RSVP + Live IST Countdown */}
        <div className="bg-white rounded-3xl p-5 shadow-md hover:shadow-xl transition border border-amber-100 relative overflow-hidden flex flex-col justify-between">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-coral absolute top-0 left-0 right-0" />
          <div className="pt-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5" />
                <span>Mess & Countdown</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-coral" />
                <span>{clock.timeText} IST</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-200/80 mb-3">
              <div className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Live Hostel Timer</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5">{clock.headline}</div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Let the kitchen reduce food waste! Having dinner in the hostel mess tonight? 🍛
            </p>
          </div>

          <button
            type="button"
            disabled={isUpdatingRsvp}
            onClick={() => onToggleDinnerRsvp(!student.dinnerRsvp)}
            className={`w-full py-3 px-4 rounded-2xl font-display font-extrabold text-xs sm:text-sm transition transform active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-60 ${
              student.dinnerRsvp
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25'
                : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-amber-200'
            }`}
          >
            <span>{student.dinnerRsvp ? '🍛 Yes, Dining Tonight! (Tap to Skip)' : '🥡 Skipping Dinner (Tap to Join)'}</span>
          </button>
        </div>

        {/* Card 2: Daily Hostel Vibe Check */}
        <div className="bg-white rounded-3xl p-5 shadow-md hover:shadow-xl transition border border-pink-100 relative overflow-hidden flex flex-col justify-between">
          <div className="h-1.5 w-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 absolute top-0 left-0 right-0" />
          <div className="pt-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-800 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hostel Vibe Check</span>
              </span>
              <span className="text-[11px] font-bold text-violet-600">Saved for Today</span>
            </div>

            <h4 className="font-display font-extrabold text-base text-slate-900 mb-2.5">
              How&apos;s your hostel vibe today?
            </h4>

            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {VIBE_OPTIONS.map((v) => {
                const isSelected = v.id === selectedVibe;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVibe(v)}
                    className={`py-2 px-1 rounded-2xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? v.activeClass
                        : 'bg-slate-50 hover:bg-pink-50/60 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-lg leading-none">{v.emoji}</span>
                    <span className="text-[9px] font-bold leading-tight truncate w-full px-0.5">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-violet-200/70 text-xs font-semibold text-violet-900">
            {activeVibe.quote}
          </div>
        </div>

        {/* Card 3: Inter-Block Live Championship */}
        <div className="bg-white rounded-3xl p-5 shadow-md hover:shadow-xl transition border border-indigo-100 relative overflow-hidden flex flex-col justify-between">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 absolute top-0 left-0 right-0" />
          <div className="pt-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Wing Championship</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {leaderboardMode === 'attendance' ? "Today's Check-Ins" : 'FRS Readiness %'}
              </span>
            </div>

            <div className="space-y-3">
              {blockStats.map((blk, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                const isMyWing = blk.id === student.block;
                return (
                  <div
                    key={blk.id}
                    className={`p-2 rounded-2xl transition ${
                      isMyWing ? 'bg-indigo-50/80 border border-indigo-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-slate-800 flex items-center gap-1.5">
                        <span>{medal}</span>
                        <span>{blk.id}</span>
                        {isMyWing && (
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold">
                            Your Wing ⭐
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-slate-700">
                        {blk.pct}% <span className="text-[10px] text-slate-400">({blk.count}/{blk.total})</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${blk.barClass} transition-all duration-700`}
                        style={{ width: `${Math.max(blk.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFunHub;
