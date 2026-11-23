import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { AttendanceSummary, AttendanceRecord } from '../../types/index.js';
import { CheckCircle2, Clock, Building2, RefreshCw, Edit3 } from 'lucide-react';

export const AttendanceRollup: React.FC = () => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Override Modal
  const [overrideStudentId, setOverrideStudentId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'PENDING_REVIEW' | 'REJECTED' | 'NOT_GIVEN'>('PRESENT');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const fetchLiveSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<AttendanceSummary>('/api/attendance/live-summary');
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDailyReport = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        date: targetDate,
        ...(selectedBlockId ? { blockId: selectedBlockId } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
      });

      const res = await apiFetch<{ records: AttendanceRecord[] }>(`/api/attendance/daily-report?${queryParams}`);
      setRecords(res.records || []);
    } catch {
      setRecords([]);
    }
  }, [targetDate, selectedBlockId, selectedStatus]);

  useEffect(() => {
    fetchLiveSummary();
    fetchDailyReport();
  }, [fetchLiveSummary, fetchDailyReport]);

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStudentId) return;

    try {
      setSubmittingOverride(true);
      await apiFetch('/api/attendance/manual-override', {
        method: 'POST',
        body: JSON.stringify({
          studentId: overrideStudentId,
          date: targetDate,
          status: overrideStatus,
          remarks: overrideRemarks,
        }),
      });

      addToast('success', 'Manual Override Logged', 'Attendance state adjusted and logged in audit trail.');
      setOverrideStudentId(null);
      setOverrideRemarks('');
      fetchLiveSummary();
      fetchDailyReport();
    } catch (err: any) {
      addToast('error', 'Override Failed', err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards & Block Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Live Attendance Roll-Up & Triage</h2>
            <p className="text-xs text-slate-500">Real-time presence across GNBVG Blocks A, B, and C</p>
          </div>
          <button
            onClick={() => {
              fetchLiveSummary();
              fetchDailyReport();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Roll-Up
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Total Active Residents</span>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{summary.metrics.totalStudents}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Present
              </span>
              <p className="text-2xl font-bold text-emerald-800 mt-1 font-mono">
                {summary.metrics.presentToday}{' '}
                <span className="text-xs font-normal">({summary.metrics.turnoutPercentage}%)</span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Not Given Today
              </span>
              <p className="text-2xl font-bold text-amber-800 mt-1 font-mono">{summary.metrics.notGivenTotal}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-xs text-blue-700 font-medium">On Approved Leave</span>
              <p className="text-2xl font-bold text-blue-800 mt-1 font-mono">{summary.metrics.onLeaveToday}</p>
            </div>
          </div>
        )}

        {/* Block A, B, C Turnout Matrix */}
        {summary?.blockStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.blockStats.map((b) => (
              <div key={b.blockId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between font-bold text-sm text-slate-800 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    Block {b.blockCode} ({b.blockName})
                  </span>
                  <span className="text-xs font-mono text-emerald-600 font-extrabold">{b.percentage}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${b.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                  <span>Present: {b.presentCount}</span>
                  <span>Missing: {b.notGivenCount}</span>
                  <span>Total: {b.totalResidents}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Report Table & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Detailed Resident Check-In Log</h3>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            />
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">All Blocks</option>
              {summary?.blockStats.map((b) => (
                <option key={b.blockId} value={b.blockId}>
                  Block {b.blockCode} ({b.blockName})
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No attendance check-ins recorded for this selection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Reg No & Branch</th>
                  <th className="py-3 px-3">Block & Room</th>
                  <th className="py-3 px-3">Check-In Time</th>
                  <th className="py-3 px-3">Verification</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">{rec.student?.fullName || 'Resident'}</td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-800 block">
                        {rec.student?.registrationNumber || 'N/A'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {rec.student?.branch} ({rec.student?.section})
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700">Block {rec.student?.block?.code}</span>
                      <span className="text-slate-500 block text-[11px]">Room {rec.student?.room?.roomNumber}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {new Date(rec.checkInTime).toLocaleTimeString()} IST
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-slate-600 block">{rec.verificationMethod.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-emerald-600 font-mono">Accuracy: ±{rec.accuracyMeters}m</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'PENDING_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setOverrideStudentId(rec.student?.id || '');
                          setOverrideStatus(rec.status as any);
                          setOverrideRemarks(`Supervisor manual review on ${targetDate}`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        title="Supervisor Manual Override"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supervisor Manual Override Modal */}
      {overrideStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
              Supervisor Manual Attendance Override
            </h3>

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PRESENT', 'PENDING_REVIEW', 'NOT_GIVEN'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOverrideStatus(s)}
                      className={`py-2 text-[11px] font-bold rounded-lg border transition ${
                        overrideStatus === s
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Trail Remarks
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="State the exception reason (e.g. Verified physically in dispensary sick room)..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideStudentId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || overrideRemarks.trim().length < 5}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg shadow"
                >
                  {submittingOverride ? 'Saving...' : 'Apply Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
