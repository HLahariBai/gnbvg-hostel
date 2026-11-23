import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.js';
import { Navbar } from '../common/Navbar.js';
import { SosAlertFeed } from './SosAlertFeed.js';
import { IntrusionAlertFeed } from './IntrusionAlertFeed.js';
import { AttendanceRollup } from './AttendanceRollup.js';
import { GatePassApprovalQueue } from './GatePassApprovalQueue.js';
import { GeofenceMapTester } from './GeofenceMapTester.js';
import { RoomMatrixView } from './RoomMatrixView.js';
import { MasterRegistryManager } from './MasterRegistryManager.js';
import { AuditLogViewer } from './AuditLogViewer.js';
import type { DashboardKPIs } from '../../types/index.js';
import {
  Flame,
  CalendarCheck,
  QrCode,
  ShieldAlert,
  Building2,
  Compass,
  Users,
  Lock,
  RefreshCw,
  Clock,
  UserCheck,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('sos');
  const [kpis, setKpis] = useState<DashboardKPIs['kpis'] | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  const fetchKpis = useCallback(async () => {
    try {
      setLoadingKpis(true);
      const res = await apiFetch<DashboardKPIs>('/api/admin/dashboard-kpis');
      setKpis(res.kpis);
    } catch {
      setKpis(null);
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const tabs = [
    { id: 'sos', label: 'SOS Emergency Feed', icon: <Flame className="w-4 h-4 text-red-500" /> },
    { id: 'attendance', label: 'Attendance Roll-Up', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'passes', label: 'Gate Passes & Overdue', icon: <QrCode className="w-4 h-4" /> },
    { id: 'intrusions', label: 'Intrusion Feed', icon: <ShieldAlert className="w-4 h-4 text-amber-500" /> },
    { id: 'rooms', label: 'Blocks & Rooms', icon: <Building2 className="w-4 h-4" /> },
    { id: 'geofence', label: 'Geofence Pin Tester', icon: <Compass className="w-4 h-4" /> },
    { id: 'registry', label: 'Master Registry', icon: <Users className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Trail', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Top Navbar */}
      <Navbar currentTab={activeTab} onSelectTab={setActiveTab} tabs={tabs} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Executive Real-Time KPI Cards & Refresh */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GNBVG Operations Live Overview</span>
          <button
            onClick={() => fetchKpis()}
            disabled={loadingKpis}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${loadingKpis ? 'animate-spin' : ''}`} />
            <span>Refresh KPIs</span>
          </button>
        </div>
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Total Residents</span>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5 font-mono">{kpis.totalResidents}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Present Today
              </span>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5 font-mono">
                {kpis.presentToday} <span className="text-xs font-normal">({kpis.turnoutPercentage}%)</span>
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <span className="text-[10px] text-amber-700 font-bold uppercase flex items-center gap-1">
                <Clock className="w-3 h-3" /> Not Given
              </span>
              <p className="text-xl font-extrabold text-amber-700 mt-0.5 font-mono">{kpis.notGivenToday}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm">
              <span className="text-[10px] text-blue-700 font-bold uppercase">Out On Pass</span>
              <p className="text-xl font-extrabold text-blue-800 mt-0.5 font-mono">{kpis.outOnPassCount}</p>
            </div>

            <div
              className={`p-3.5 rounded-xl border shadow-sm ${
                kpis.overduePassesCount > 0 ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-white border-slate-200'
              }`}
            >
              <span className="text-[10px] text-red-700 font-bold uppercase">Overdue Passes</span>
              <p className="text-xl font-extrabold text-red-700 mt-0.5 font-mono">{kpis.overduePassesCount}</p>
            </div>

            <div
              className={`p-3.5 rounded-xl border shadow-sm ${
                kpis.activeSosCount > 0 ? 'bg-red-600 text-white border-red-600 animate-bounce' : 'bg-white border-slate-200'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase ${kpis.activeSosCount > 0 ? 'text-red-100' : 'text-slate-500'}`}>
                Active SOS
              </span>
              <p className={`text-xl font-extrabold mt-0.5 font-mono ${kpis.activeSosCount > 0 ? 'text-white' : 'text-slate-900'}`}>
                {kpis.activeSosCount}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-[10px] text-amber-700 font-bold uppercase">Blocked Intrusions</span>
              <p className="text-xl font-extrabold text-amber-800 mt-0.5 font-mono">{kpis.blockedIntrusionsCount}</p>
            </div>
          </div>
        )}

        {/* Tab Viewport */}
        <div>
          {activeTab === 'sos' && <SosAlertFeed />}
          {activeTab === 'attendance' && <AttendanceRollup />}
          {activeTab === 'passes' && <GatePassApprovalQueue />}
          {activeTab === 'intrusions' && <IntrusionAlertFeed />}
          {activeTab === 'rooms' && <RoomMatrixView />}
          {activeTab === 'geofence' && <GeofenceMapTester />}
          {activeTab === 'registry' && <MasterRegistryManager />}
          {activeTab === 'audit' && <AuditLogViewer />}
        </div>
      </main>
    </div>
  );
};
