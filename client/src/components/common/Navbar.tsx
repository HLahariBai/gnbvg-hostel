import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { Shield, Radio, LogOut, User as UserIcon, Building2 } from 'lucide-react';
import type { Role } from '../../types/index.js';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  tabs?: Array<{ id: string; label: string; icon?: React.ReactNode }>;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, tabs }) => {
  const { user, logout, demoSwitchRole } = useAuth();
  const { isConnected, activeSosCount } = useSocket();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30 text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">GNBVG</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400">
                  GPREC Kurnool
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                G. Narayanamma Balikala Vasathi Gruham
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (if passed) */}
          {tabs && tabs.length > 0 && onSelectTab && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800/80">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right: Real-time Status, Role Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Live WebSocket Indicator */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                isConnected
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
              }`}
              title={isConnected ? 'Real-Time WebSocket Engine Connected' : 'Reconnecting to Real-Time Engine...'}
            >
              <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
              <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'CONNECTING'}</span>
            </div>

            {/* Active SOS Badge for Admins/Wardens */}
            {activeSosCount > 0 && (
              <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500 text-red-400 animate-pulse font-bold">
                <span>{activeSosCount} SOS ACTIVE</span>
              </div>
            )}

            {/* Demo Mode Role Switcher */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 px-2 uppercase font-mono">Demo:</span>
              {(['STUDENT', 'WARDEN', 'ADMIN'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => demoSwitchRole(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    user?.role === r
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {r === 'STUDENT' ? 'Student' : r === 'WARDEN' ? 'Warden' : 'Admin'}
                </button>
              ))}
            </div>

            {/* User Profile Info */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.fullName || 'User'}</p>
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  {user?.blockName && (
                    <span className="flex items-center gap-0.5">
                      <Building2 className="w-2.5 h-2.5" /> Block {user.blockName} ({user.roomNumber})
                    </span>
                  )}
                  {!user?.blockName && <span>{user?.role}</span>}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                {user?.fullName?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                title="Sign out of GNBVG Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
