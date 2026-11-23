import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { SOSAlert } from '../../types/index.js';
import { Flame, CheckCircle, ShieldAlert, Phone, Navigation, Clock, MessageSquare } from 'lucide-react';

export const SosAlertFeed: React.FC = () => {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'RESOLVED' | 'FALSE_ALARM'>('RESOLVED');
  const [submitting, setSubmitting] = useState(false);

  const fetchActiveAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<SOSAlert[]>('/api/sos/active');
      setAlerts(res || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveAlerts();
  }, [fetchActiveAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await apiFetch(`/api/sos/${id}/acknowledge`, { method: 'PATCH' });
      addToast('info', 'SOS Alert Acknowledged', 'Dispatched notification to response teams.');
      fetchActiveAlerts();
    } catch (err: any) {
      addToast('error', 'Action Failed', err.message);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlertId) return;

    try {
      setSubmitting(true);
      await apiFetch(`/api/sos/${resolvingAlertId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: resolutionStatus,
          resolutionNotes,
        }),
      });

      addToast('success', 'SOS Alert Resolved', `Alert marked as ${resolutionStatus}.`);
      setResolvingAlertId(null);
      setResolutionNotes('');
      fetchActiveAlerts();
    } catch (err: any) {
      addToast('error', 'Resolution Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-red-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 rounded-xl text-red-600">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">High-Priority Emergency SOS Feed</h2>
            <p className="text-xs text-slate-500">Live panic triggers with audio-visual alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-700 animate-pulse">
            {alerts.length} ACTIVE ALERTS
          </span>
          <button
            onClick={fetchActiveAlerts}
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-6 text-center">Loading emergency feed...</p>
      ) : alerts.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <ShieldAlert className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700">All Clear: No Active SOS Alerts</p>
          <p className="text-xs text-slate-400 mt-0.5">Campus perimeter and resident wings are currently secure.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl p-5 border-2 transition ${
                alert.status === 'TRIGGERED'
                  ? 'border-red-500 bg-red-50/50 shadow-md'
                  : 'border-amber-400 bg-amber-50/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">
                      {alert.student?.fullName || alert.studentName || 'Resident Hosteller'}
                    </span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-white border rounded">
                      {alert.student?.registrationNumber || alert.registrationNumber}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        alert.status === 'TRIGGERED'
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                    <span className="font-semibold">
                      Location: Block {alert.block?.name || alert.blockCode} • Room {alert.room?.roomNumber || alert.roomNumber}
                    </span>
                    {alert.student?.primaryPhone && (
                      <span className="flex items-center gap-1 font-mono text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" />
                        Student: {alert.student.primaryPhone}
                      </span>
                    )}
                    {(alert.student?.parentGuardian?.fatherPhone || alert.parentPhone) && (
                      <span className="flex items-center gap-1 font-mono text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" />
                        Parent: {alert.student?.parentGuardian?.fatherPhone || alert.parentPhone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Triggered: {new Date(alert.createdAt).toLocaleTimeString()} IST ({alert.triggerType})
                    </span>
                    {alert.latitude && alert.longitude && (
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-blue-500" />
                        GPS: {alert.latitude.toFixed(4)}°, {alert.longitude.toFixed(4)}°
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {alert.status === 'TRIGGERED' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow transition"
                    >
                      Acknowledge Response
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setResolvingAlertId(alert.id);
                      setResolutionNotes('');
                    }}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Resolve Alert
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingAlertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Resolve Emergency SOS Incident
            </h3>

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionStatus('RESOLVED')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      resolutionStatus === 'RESOLVED'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Incident Resolved
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionStatus('FALSE_ALARM')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      resolutionStatus === 'FALSE_ALARM'
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    False Alarm / Accidental
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Resolution Notes</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the response actions taken, staff attending, and resolution confirmation..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingAlertId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || resolutionNotes.trim().length < 5}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg shadow"
                >
                  {submitting ? 'Recording...' : 'Close & Archive SOS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
