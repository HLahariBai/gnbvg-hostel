import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SocketProvider } from './context/SocketContext.js';
import { ToastContainer } from './components/common/ToastContainer.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { StudentDashboard } from './components/student/StudentDashboard.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import ZostelHostelPortal from './pages/ZostelHostelPortal.js';
import { Shield, ShieldAlert, LogOut, Loader2, Sparkles, Moon } from 'lucide-react';

const ClassicAppRouter: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // 1. Initial Authentication & Session Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-2xl">
            <Shield className="w-10 h-10 animate-pulse" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-xl -z-10 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">
          GNBVG Hostel Management Portal
        </h2>
        <p className="text-xs text-slate-400 mb-6 text-center max-w-sm">
          G. Pulla Reddy Engineering College (Autonomous), Kurnool
        </p>
        <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying encrypted session & credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Login or Resident Registration
  if (!isAuthenticated || !user) {
    if (authView === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateToRegister={() => setAuthView('register')} />;
  }

  // 3. Authenticated Role Guarded Portals
  if (user.role === 'STUDENT') {
    return <StudentDashboard />;
  }

  if (user.role === 'WARDEN' || user.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  // Fallback for unauthorized / unrecognized role
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl mb-4">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h2 className="text-xl font-bold mb-2">Unauthorized Role Access</h2>
      <p className="text-xs text-slate-400 max-w-md mb-6">
        Your authenticated account does not have sufficient RBAC privileges to access either the Student or Warden/Admin portal.
      </p>
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out & Switch Account</span>
      </button>
    </div>
  );
};

export default function App() {
  // Default to the vibrant Zostel-inspired portal requested by user
  const [portalTheme, setPortalTheme] = useState<'zostel' | 'classic'>('zostel');

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            {portalTheme === 'zostel' ? <ZostelHostelPortal /> : <ClassicAppRouter />}
            <ToastContainer />

            {/* Floating Portal Theme Switcher */}
            <div className="fixed bottom-4 left-4 z-50">
              <button
                onClick={() => setPortalTheme((prev) => (prev === 'zostel' ? 'classic' : 'zostel'))}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border text-xs font-bold transition-all transform hover:scale-105 backdrop-blur-md bg-white/90 text-slate-800 border-slate-200 hover:bg-white"
                title="Toggle between Zostel Vibrant Experience and Classic Dark Portal"
              >
                {portalTheme === 'zostel' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span>Switch to Classic Dark Portal</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-coral" />
                    <span>Switch to Vibrant Zostel Portal</span>
                  </>
                )}
              </button>
            </div>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
