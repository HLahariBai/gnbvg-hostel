import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { HostellerRegistryEntry } from '../../types/index.js';
import { Users, Plus, Search, RefreshCw, GraduationCap, CheckCircle } from 'lucide-react';

export const MasterRegistryManager: React.FC = () => {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<HostellerRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('');

  // Add Single Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [studentName, setStudentName] = useState('');
  const [blockCode, setBlockCode] = useState<'A' | 'B' | 'C'>('A');
  const [roomNumber, setRoomNumber] = useState('A-101');
  const [academicYear, setAcademicYear] = useState<number>(1);
  const [branch, setBranch] = useState('CSE');
  const [section, setSection] = useState('A');
  const [submitting, setSubmitting] = useState(false);

  // Rollover Confirmation
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);

  const fetchRegistry = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(blockFilter ? { blockCode: blockFilter } : {}),
      });

      const res = await apiFetch<{ records: HostellerRegistryEntry[] }>(`/api/admin/registry?${queryParams}`);
      setEntries(res.records || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [search, blockFilter]);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiFetch('/api/admin/registry/single', {
        method: 'POST',
        body: JSON.stringify({
          registrationNumber: regNo,
          collegeEmail,
          studentName,
          blockCode,
          roomNumber,
          academicYear,
          branch,
          section,
        }),
      });

      addToast('success', 'Student Whitelisted', `${studentName} (${regNo}) added to Hosteller Registry.`);
      setShowAddModal(false);
      setRegNo('');
      setCollegeEmail('');
      setStudentName('');
      fetchRegistry();
    } catch (err: any) {
      addToast('error', 'Addition Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnnualRollover = async () => {
    try {
      setRollingOver(true);
      const res = await apiFetch<any>('/api/admin/rollover', { method: 'POST' });
      addToast(
        'success',
        'Academic Year Rollover Complete',
        `Promoted 1st->2nd (${res.promotedTo2nd}), 2nd->3rd (${res.promotedTo3rd}), 3rd->4th (${res.promotedTo4th}), Graduated (${res.graduatedToAlumni})`
      );
      setShowRolloverConfirm(false);
      fetchRegistry();
    } catch (err: any) {
      addToast('error', 'Rollover Failed', err.message);
    } finally {
      setRollingOver(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Hosteller Master Registry Whitelist</h2>
          <p className="text-xs text-slate-500">Authoritative resident whitelist pre-approved for institutional registration</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRolloverConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition"
          >
            <GraduationCap className="w-4 h-4" />
            Annual Rollover
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            Add Resident
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by registration number, student name, or email..."
            className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800"
          />
        </div>

        <select
          value={blockFilter}
          onChange={(e) => setBlockFilter(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
        >
          <option value="">All Blocks</option>
          <option value="A">Block A (Arundhathi)</option>
          <option value="B">Block B (Annapurna)</option>
          <option value="C">Block C (Anuradha)</option>
        </select>

        <button
          onClick={fetchRegistry}
          className="px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-8 text-center">Loading registry records...</p>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No Registry Records Found</p>
          <p className="text-xs mt-0.5">Click &quot;Add Resident&quot; above to whitelist an eligible hosteller.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Reg No & Email</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Year & Branch</th>
                <th className="py-3 px-3">Block & Room</th>
                <th className="py-3 px-3">Registered Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-900 block">{entry.registrationNumber}</span>
                    <span className="text-[11px] text-slate-500">{entry.collegeEmail}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{entry.studentName}</td>
                  <td className="py-3 px-3">
                    Year {entry.academicYear} • {entry.branch} ({entry.section})
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    Block {entry.blockCode} • Room {entry.roomNumber}
                  </td>
                  <td className="py-3 px-3">
                    {entry.isRegistered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3" /> Registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Pending Registration
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Single Resident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8">
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Add Eligible Resident to Whitelist
            </h3>

            <form onSubmit={handleAddSingle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    required
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="e.g. 239X1A0501"
                    className="w-full text-xs font-mono uppercase px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official GPREC Email</label>
                  <input
                    type="email"
                    required
                    value={collegeEmail}
                    onChange={(e) => setCollegeEmail(e.target.value)}
                    placeholder="name@gprec.ac.in"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Full name as per official college roll"
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Allocated Block</label>
                  <select
                    value={blockCode}
                    onChange={(e) => setBlockCode(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  >
                    <option value="A">Block A (Arundhathi)</option>
                    <option value="B">Block B (Annapurna)</option>
                    <option value="C">Block C (Anuradha)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. A-101"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(Number(e.target.value))}
                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    required
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="CSE"
                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="A"
                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg"
                >
                  {submitting ? 'Whitelisting...' : 'Add to Registry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annual Rollover Confirmation Dialog */}
      {showRolloverConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-md w-full p-6 text-center">
            <GraduationCap className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">Confirm Annual Academic Year Rollover</h3>
            <p className="text-xs text-slate-600 mb-4">
              This action will advance all resident academic cohorts (1st $\to$ 2nd, 2nd $\to$ 3rd, 3rd $\to$ 4th) and graduate 4th year residents to Alumni status. All historical attendance logs will be preserved.
            </p>

            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowRolloverConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAnnualRollover}
                disabled={rollingOver}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow"
              >
                {rollingOver ? 'Processing Rollover...' : 'Execute Rollover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
