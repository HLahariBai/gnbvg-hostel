import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { LeaveRequest } from '../../types/index.js';
import { Calendar, PlusCircle, Clock } from 'lucide-react';

export const LeaveRequestForm: React.FC = () => {
  const { addToast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Form fields
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('HOME_VISIT');
  const [reasonCategory, setReasonCategory] = useState('Festival / Family Visit');
  const [reasonDetails, setReasonDetails] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [parentConsentVerified, setParentConsentVerified] = useState(true);
  const [parentConsentMethod, setParentConsentMethod] = useState<'PHONE_CALL' | 'SMS_OTP' | 'PORTAL_CONFIRM'>('PHONE_CALL');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<LeaveRequest[]>('/api/leaves/my-leaves');
      setLeaves(res || []);
    } catch {
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiFetch('/api/leaves/apply', {
        method: 'POST',
        body: JSON.stringify({
          leaveType,
          reasonCategory,
          reasonDetails,
          fromDate: new Date(fromDate).toISOString(),
          toDate: new Date(toDate).toISOString(),
          expectedReturnDate: new Date(expectedReturnDate).toISOString(),
          parentConsentVerified,
          parentConsentMethod,
        }),
      });

      addToast('success', 'Leave Application Submitted', 'Routed to Chief Warden for review.');
      setShowApplyModal(false);
      setReasonDetails('');
      fetchLeaves();
    } catch (err: any) {
      addToast('error', 'Submission Failed', err.message || 'Could not submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Formal Leave Requests</h2>
          <p className="text-xs text-slate-500">Home visits, medical leaves, and academic excursions</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          Apply for Leave
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading leave requests...</div>
      ) : leaves.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No leave requests found</p>
          <p className="text-xs text-slate-400 mt-0.5">Submit a request above whenever leaving overnight.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <div
              key={leave.id}
              className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {leave.leaveType.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">({leave.reasonCategory})</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      leave.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : leave.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {leave.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-1">{leave.reasonDetails}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    {new Date(leave.fromDate).toLocaleDateString()} to{' '}
                    {new Date(leave.toDate).toLocaleDateString()}
                  </span>
                  <span>• Return: {new Date(leave.expectedReturnDate).toLocaleDateString()}</span>
                </div>
              </div>

              {leave.decisionRemarks && (
                <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 max-w-xs">
                  <span className="font-semibold text-slate-700">Warden Remark:</span> {leave.decisionRemarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Apply for Hostel Leave
            </h3>

            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200"
                  >
                    <option value="HOME_VISIT">Home Visit</option>
                    <option value="MEDICAL">Medical Treatment</option>
                    <option value="ACADEMIC">Academic Excursion / Conference</option>
                    <option value="EMERGENCY">Family Emergency</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason Category</label>
                  <input
                    type="text"
                    required
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    placeholder="e.g. Festival / Medical"
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Explanation</label>
                <textarea
                  required
                  rows={2}
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Detail reasons and destination address..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Date</label>
                  <input
                    type="date"
                    required
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="parentConsent"
                    checked={parentConsentVerified}
                    onChange={(e) => setParentConsentVerified(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="parentConsent" className="text-xs text-slate-600">
                    Parent / Guardian Consent Confirmed
                  </label>
                </div>
                {parentConsentVerified && (
                  <select
                    value={parentConsentMethod}
                    onChange={(e) => setParentConsentMethod(e.target.value as any)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="PHONE_CALL">Consent: Phone Call</option>
                    <option value="SMS_OTP">Consent: SMS OTP</option>
                    <option value="PORTAL_CONFIRM">Consent: Portal Confirmation</option>
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg"
                >
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
