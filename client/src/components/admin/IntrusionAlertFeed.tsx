import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { IntrusionAttempt } from '../../types/index.js';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export const IntrusionAlertFeed: React.FC = () => {
  const { addToast } = useToast();
  const [intrusions, setIntrusions] = useState<IntrusionAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [triageId, setTriageId] = useState<string | null>(null);
  const [triageStatus, setTriageStatus] = useState<'ACKNOWLEDGED' | 'FLAGGED_TO_PRINCIPAL' | 'WHITELISTED'>('ACKNOWLEDGED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Whitelist extra fields
  const [studentName, setStudentName] = useState('');
  const [blockCode, setBlockCode] = useState<'A' | 'B' | 'C'>('A');
  const [roomNumber, setRoomNumber] = useState('A-101');
  const [academicYear, setAcademicYear] = useState<number>(1);
  const [branch, setBranch] = useState('CSE');
  const [section, setSection] = useState('A');

  const fetchIntrusions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ attempts: IntrusionAttempt[] }>('/api/admin/intrusions');
      setIntrusions(res.attempts || []);
    } catch {
      setIntrusions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntrusions();
  }, [fetchIntrusions]);

  const handleOpenTriage = (item: IntrusionAttempt) => {
    setTriageId(item.id);
    setTriageStatus('ACKNOWLEDGED');
    setReviewNotes(`Reviewed entry for ${item.attemptedName || item.registrationNumber}`);
    setStudentName(item.attemptedName || 'Admitted Student');
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageId) return;

    try {
      setSubmitting(true);
      await apiFetch(`/api/admin/intrusions/${triageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: triageStatus,
          reviewNotes,
          ...(triageStatus === 'WHITELISTED'
            ? {
                whitelistData: {
                  studentName,
                  blockCode,
                  roomNumber,
                  academicYear,
                  branch,
                  section,
                },
              }
            : {}),
        }),
      });

      addToast('success', 'Intrusion Triaged', `Attempt marked as ${triageStatus}.`);
      setTriageId(null);
      fetchIntrusions();
    } catch (err: any) {
      addToast('error', 'Triage Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Security Intrusion & Access Gatekeeper Feed</h2>
            <p className="text-xs text-slate-500">Non-hosteller registration attempts blocked by Hosteller Registry whitelist</p>
          </div>
        </div>

        <button
          onClick={fetchIntrusions}
          className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Feed
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-6 text-center">Loading intrusion feed...</p>
      ) : intrusions.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <p className="text-sm font-semibold text-slate-700">No Blocked Intrusions</p>
          <p className="text-xs text-slate-400 mt-0.5">All registration attempts have matched verified hosteller records.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Attempted Name</th>
                <th className="py-3 px-3">Reg No & Email</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Gatekeeper Status</th>
                <th className="py-3 px-3 text-right">Triage Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {intrusions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3 font-semibold text-slate-900">{item.attemptedName || 'Unknown'}</td>
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-800 block">{item.registrationNumber || 'N/A'}</span>
                    <span className="text-[11px] text-slate-500">{item.email}</span>
                  </td>
                  <td className="py-3 px-3 font-mono">{item.phone || 'N/A'}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    {new Date(item.attemptedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'BLOCKED'
                          ? 'bg-red-100 text-red-800'
                          : item.status === 'WHITELISTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'FLAGGED_TO_PRINCIPAL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleOpenTriage(item)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      Triage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Triage Modal */}
      {triageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6">
            <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
              Triage Unauthorized Registration Attempt
            </h3>

            <form onSubmit={handleTriageSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Triage Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTriageStatus('ACKNOWLEDGED')}
                    className={`py-2 text-[11px] font-bold rounded-lg border transition ${
                      triageStatus === 'ACKNOWLEDGED'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriageStatus('FLAGGED_TO_PRINCIPAL')}
                    className={`py-2 text-[11px] font-bold rounded-lg border transition ${
                      triageStatus === 'FLAGGED_TO_PRINCIPAL'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Flag to Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriageStatus('WHITELISTED')}
                    className={`py-2 text-[11px] font-bold rounded-lg border transition ${
                      triageStatus === 'WHITELISTED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Add to Whitelist
                  </button>
                </div>
              </div>

              {triageStatus === 'WHITELISTED' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2.5 text-xs">
                  <p className="font-semibold text-emerald-900">Configure Master Registry Whitelist Entry</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 block">Student Name</label>
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block">Hostel Block</label>
                      <select
                        value={blockCode}
                        onChange={(e) => setBlockCode(e.target.value as any)}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      >
                        <option value="A">Block A (Arundhathi)</option>
                        <option value="B">Block B (Annapurna)</option>
                        <option value="C">Block C (Anuradha)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 block">Room Number</label>
                      <input
                        type="text"
                        required
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block">Year</label>
                      <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      >
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block">Branch</label>
                      <input
                        type="text"
                        required
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block">Section</label>
                      <input
                        type="text"
                        required
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  required
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTriageId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow"
                >
                  {submitting ? 'Applying...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
