import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { GatePass } from '../../types/index.js';
import { Check, X, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

export const GatePassApprovalQueue: React.FC = () => {
  const { addToast } = useToast();
  const [pendingPasses, setPendingPasses] = useState<GatePass[]>([]);
  const [overduePasses, setOverduePasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);

  // QR Verification Tool
  const [qrInput, setQrInput] = useState('');
  const [qrVerificationResult, setQrVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pending, overdue] = await Promise.all([
        apiFetch<GatePass[]>('/api/gate-pass/pending').catch(() => []),
        apiFetch<GatePass[]>('/api/gate-pass/overdue').catch(() => []),
      ]);
      setPendingPasses(pending || []);
      setOverduePasses(overdue || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReview = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await apiFetch(`/api/gate-pass/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, remarks: `Warden decision: ${decision}` }),
      });
      addToast('success', `Pass ${decision}D`, `Gate pass has been ${decision.toLowerCase()}d.`);
      fetchData();
    } catch (err: any) {
      addToast('error', 'Action Failed', err.message);
    }
  };

  const handleVerifyQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    try {
      setVerifying(true);
      const res = await apiFetch('/api/gate-pass/verify-qr', {
        method: 'POST',
        body: JSON.stringify({ qrData: qrInput.trim() }),
      });
      setQrVerificationResult(res);
      addToast('success', 'Digital QR Verified', 'HMAC signature matches official GNBVG signing key.');
    } catch (err: any) {
      setQrVerificationResult({ error: err.message || 'Signature mismatch' });
      addToast('error', 'QR Invalid', err.message || 'Digital signature check failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overdue Passes Section (if any) */}
      {overduePasses.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            <span>OVERDUE GATE PASSES ({overduePasses.length} STUDENTS)</span>
          </div>
          <p className="text-xs text-red-600 mb-4">
            The following students checked out through the Main Gate and have not returned past their approved return time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overduePasses.map((pass) => (
              <div key={pass.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{pass.student?.fullName}</span>
                  <span className="font-mono text-xs font-bold text-red-700">{pass.passNumber}</span>
                </div>
                <p className="text-xs text-slate-600">
                  Block {pass.student?.block?.code} • Room {pass.student?.room?.roomNumber} • Phone:{' '}
                  {pass.student?.primaryPhone}
                </p>
                <p className="text-[11px] text-red-600 font-mono">
                  Expired At: {new Date(pass.validUntil).toLocaleString()} IST
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Pass Approvals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Pending Gate Pass Approval Queue</h2>
            <p className="text-xs text-slate-500">Day Passes and Night Out Passes awaiting warden sign-off</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Queue
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading pending approvals...</p>
        ) : pendingPasses.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Check className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Approval Queue Empty</p>
            <p className="text-xs text-slate-400 mt-0.5">All student gate pass requests have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPasses.map((pass) => (
              <div
                key={pass.id}
                className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{pass.student?.fullName}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {pass.student?.registrationNumber}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {pass.passType === 'DAY_PASS' ? 'Day Pass' : 'Night Out Pass'}
                    </span>
                    {pass.parentConfirmed && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Parent Consented
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700">
                    <strong className="text-slate-900">Destination:</strong> {pass.destination} •{' '}
                    <strong className="text-slate-900">Reason:</strong> {pass.reason}
                  </p>

                  <p className="text-[11px] text-slate-500 font-mono">
                    Valid: {new Date(pass.validFrom).toLocaleString()} to {new Date(pass.validUntil).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(pass.id, 'APPROVE')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Approve & Sign QR
                  </button>
                  <button
                    onClick={() => handleReview(pass.id, 'REJECT')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-red-600 font-semibold text-xs rounded-xl transition flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gate Security Digital QR Verification Tester */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm">Gate Checkpoint Digital QR Scanner</h3>
        </div>

        <form onSubmit={handleVerifyQr} className="flex gap-2 mb-4">
          <input
            type="text"
            required
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            placeholder="Paste or scan QR string e.g. GNBVG:GP-2026-XYZ:student-id:timestamp:signature"
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={verifying}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            {verifying ? 'Verifying...' : 'Verify Signature'}
          </button>
        </form>

        {qrVerificationResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            {qrVerificationResult.error ? (
              <p className="text-red-400">❌ Error: {qrVerificationResult.error}</p>
            ) : (
              <div className="space-y-1 text-slate-300">
                <p className="text-emerald-400 font-bold">✔ VALID DIGITAL HMAC-SHA-256 SIGNATURE</p>
                <p>Pass: {qrVerificationResult.pass?.passNumber}</p>
                <p>Student: {qrVerificationResult.pass?.student?.fullName}</p>
                <p>Status: {qrVerificationResult.status}</p>
                <p>Expired: {qrVerificationResult.isExpired ? 'YES' : 'NO'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
