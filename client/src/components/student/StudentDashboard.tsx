import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Navbar } from '../common/Navbar.js';
import { StickySosButton } from './StickySosButton.js';
import { AttendanceScanner } from './AttendanceScanner.js';
import { GatePassManager } from './GatePassManager.js';
import { LeaveRequestForm } from './LeaveRequestForm.js';
import { EmergencyDirectory } from './EmergencyDirectory.js';
import { SafetyTicketModal } from './SafetyTicketModal.js';
import {
  CalendarCheck,
  QrCode,
  FileText,
  LifeBuoy,
  ShieldAlert,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('attendance');
  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'passes', label: 'Gate Passes', icon: <QrCode className="w-4 h-4" /> },
    { id: 'leaves', label: 'Leaves', icon: <FileText className="w-4 h-4" /> },
    { id: 'directory', label: 'Safety & Help', icon: <LifeBuoy className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* Top Navbar */}
      <Navbar currentTab={activeTab} onSelectTab={setActiveTab} tabs={tabs} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Student Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 mb-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
              <span>GNBVG RESIDENT PORTAL</span>
              <span>•</span>
              <span>Reg: {user?.registrationNumber || '219X1A0501'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Welcome back, {user?.fullName || 'Resident Hosteller'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Allocated Room: <strong className="text-slate-200">{user?.roomNumber || 'A-101'}</strong> in{' '}
              <strong className="text-slate-200">Block {user?.blockName || 'Arundhathi'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIncidentModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 shadow transition flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Report Issue / Hazard
            </button>
          </div>
        </div>

        {/* Tab Viewport */}
        <div>
          {activeTab === 'attendance' && <AttendanceScanner />}
          {activeTab === 'passes' && <GatePassManager />}
          {activeTab === 'leaves' && <LeaveRequestForm />}
          {activeTab === 'directory' && <EmergencyDirectory />}
        </div>
      </main>

      {/* Sticky SOS Panic Button - ALWAYS mounted across all student tabs */}
      <StickySosButton />

      {/* Safety Ticket Incident Modal */}
      <SafetyTicketModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
      />
    </div>
  );
};
