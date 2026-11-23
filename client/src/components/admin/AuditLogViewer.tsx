import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import type { AuditLogEntry } from '../../types/index.js';
import { FileText, Search, RefreshCw, Lock } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSearch, setActionSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '30',
        ...(actionSearch ? { action: actionSearch } : {}),
        ...(entityFilter ? { entityName: entityFilter } : {}),
      });

      const res = await apiFetch<{ logs: AuditLogEntry[]; totalPages: number }>(`/api/admin/audit-logs?${queryParams}`);
      setLogs(res.logs || []);
      setTotalPages(res.totalPages || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionSearch, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800">Immutable System Audit Trail</h2>
          </div>
          <p className="text-xs text-slate-500">
            Cryptographically traceable, non-repudiable log of all administrative actions and security mutations
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Audit Trail
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            placeholder="Search action (e.g. ATTENDANCE_MANUAL_OVERRIDE, INTRUSION_TRIAGED, GATE_PASS_APPROVED)..."
            className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 font-mono"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
        >
          <option value="">All Entities</option>
          <option value="Attendance">Attendance</option>
          <option value="GatePass">GatePass</option>
          <option value="SOSAlert">SOSAlert</option>
          <option value="SafetyTicket">SafetyTicket</option>
          <option value="UnauthorizedAccessAttempt">UnauthorizedAccessAttempt</option>
          <option value="HostellerRegistry">HostellerRegistry</option>
          <option value="Hostel">Hostel</option>
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-8 text-center">Loading immutable audit logs...</p>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No Audit Logs Found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor & Role</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity & ID</th>
                <th className="py-3 px-3">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-slate-800 block text-[11px] truncate max-w-[140px]">
                      {log.actor?.email || log.actorRole}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{log.actorRole}</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 text-[11px]">{log.action}</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">{log.entityName}</span>
                    {log.entityId && <span className="text-slate-400 block text-[10px]">#{log.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400">{log.ipAddress || 'Internal'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 border border-slate-200 rounded text-slate-600 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border border-slate-200 rounded text-slate-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
