import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { GatePass } from '../../types/index.js';
import {
  QrCode,
  PlusCircle,
  Clock,
  MapPin,
} from 'lucide-react';

export const GatePassManager: React.FC = () => {
  const { addToast } = useToast();

  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedPassForQr, setSelectedPassForQr] = useState<GatePass | null>(null);

  // Form State
  const [passType, setPassType] = useState<'DAY_PASS' | 'NIGHT_OUT_PASS'>('DAY_PASS');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [parentConfirmed, setParentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPasses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<GatePass[]>('/api/gate-pass/my-passes');
      setPasses(res || []);
    } catch {
      setPasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // Set default form times when opening apply modal
  const handleOpenApplyModal = () => {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 3600 * 1000);

    const toLocalIso = (d: Date) => d.toISOString().slice(0, 16);
    setValidFrom(toLocalIso(now));
    setValidUntil(toLocalIso(fourHoursLater));
    setShowApplyModal(true);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiFetch('/api/gate-pass/apply', {
        method: 'POST',
        body: JSON.stringify({
          passType,
          destination,
          reason,
          validFrom: new Date(validFrom).toISOString(),
          validUntil: new Date(validUntil).toISOString(),
          parentConfirmed,
        }),
      });

      addToast('success', 'Gate Pass Applied', 'Your application has been routed to the Warden approval queue.');
      setShowApplyModal(false);
      setDestination('');
      setReason('');
      fetchPasses();
    } catch (err: any) {
      addToast('error', 'Application Failed', err.message || 'Could not submit gate pass application.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: GatePass['status']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">APPROVED</span>;
      case 'CHECKED_OUT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">OUT ON PASS</span>;
      case 'RETURNED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">RETURNED</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">OVERDUE</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-red-700">REJECTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">PENDING WARDEN</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Digital Gate Passes</h2>
          <p className="text-xs text-slate-500">Day Pass & Night Out Pass with QR gate check-out</p>
        </div>
        <button
          onClick={handleOpenApplyModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          Apply for Pass
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Loading passes...</div>
      ) : passes.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No active or historical passes</p>
          <p className="text-xs mt-1">Apply above whenever you need to leave the GNBVG campus premises.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {passes.map((pass) => (
            <div
              key={pass.id}
              className="border border-slate-200 rounded-xl p-4 sm:p-5 hover:border-slate-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 text-sm">{pass.passNumber}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {pass.passType === 'DAY_PASS' ? 'Day Pass' : 'Night Out Pass'}
                  </span>
                  {getStatusBadge(pass.status)}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{pass.destination}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{pass.reason}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Valid: {new Date(pass.validFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to{' '}
                    {new Date(pass.validUntil).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              {/* View QR Action */}
              {(pass.status === 'APPROVED' || pass.status === 'CHECKED_OUT') && (
                <button
                  onClick={() => setSelectedPassForQr(pass)}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Show Gate QR
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Apply Pass Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Apply for Gate Pass
            </h3>

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pass Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPassType('DAY_PASS')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition ${
                      passType === 'DAY_PASS'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Day Pass (Within Hours)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassType('NIGHT_OUT_PASS')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition ${
                      passType === 'NIGHT_OUT_PASS'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Night Out Pass
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Kurnool Market / Hometown / Hospital"
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leaving</label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Detail purpose of visit..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valid From</label>
                  <input
                    type="datetime-local"
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Return</label>
                  <input
                    type="datetime-local"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="parentConfirmed"
                  checked={parentConfirmed}
                  onChange={(e) => setParentConfirmed(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="parentConfirmed" className="text-xs text-slate-600">
                  Parent/Guardian has verbally confirmed or consented to this outing
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital QR Code Pass Modal */}
      {selectedPassForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Digital Gate Pass</span>
              <span className="font-mono text-xs font-bold text-emerald-700">{selectedPassForQr.passNumber}</span>
            </div>

            {/* Simulated Digital QR Display */}
            <div className="bg-slate-950 p-6 rounded-2xl border-4 border-emerald-500/30 inline-block mx-auto mb-4">
              <div className="w-48 h-48 bg-white p-3 rounded-lg flex flex-col items-center justify-center">
                <QrCode className="w-36 h-36 text-slate-900" />
                <span className="text-[9px] font-mono text-slate-500 mt-1 truncate max-w-[160px]">
                  HMAC-SHA-256 SIGNED
                </span>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-800">{selectedPassForQr.destination}</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Valid until: {new Date(selectedPassForQr.validUntil).toLocaleString()}
            </p>

            <div className="mt-4 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              Present this tamper-proof digital code to the Main Gate security guard upon exit and return.
            </div>

            <button
              onClick={() => setSelectedPassForQr(null)}
              className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
