import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Role } from '../types/index.js';
import { apiFetch, setCsrfToken } from '../lib/api.js';

interface LoginResponse {
  status: string;
  mfaRequired: boolean;
  tempToken?: string;
  user?: User;
  csrfToken?: string;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaPending: { required: boolean; tempToken: string } | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyMfa: (totpCode: string) => Promise<void>;
  cancelMfa: () => void;
  logout: () => Promise<void>;
  setUserDirectly: (user: User | null) => void;
  demoSwitchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mfaPending, setMfaPending] = useState<{ required: boolean; tempToken: string } | null>(null);

  // Helper to normalize user object from backend
  const formatUser = (rawUser: any): User => {
    return {
      ...rawUser,
      fullName: rawUser.fullName || rawUser.name || '',
      role: (rawUser.role || 'STUDENT').toUpperCase() as Role,
      registrationNumber: rawUser.registrationNumber || rawUser.roll_number,
      blockName: rawUser.blockName || rawUser.block,
      roomNumber: rawUser.roomNumber || rawUser.room_number,
    };
  };

  // Check current session on application mount
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ user: any }>('/api/auth/me');
      if (res && res.user) {
        setUser(formatUser(res.user));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }

    if (res.mfaRequired && res.tempToken) {
      setMfaPending({ required: true, tempToken: res.tempToken });
      return res;
    }

    if (res.user) {
      setUser(formatUser(res.user));
      setMfaPending(null);
    }

    return res;
  };

  const verifyMfa = async (totpCode: string) => {
    if (!mfaPending?.tempToken) {
      throw new Error('No active MFA verification challenge found.');
    }

    const res = await apiFetch<{ user: any; csrfToken?: string }>('/api/auth/mfa/verify-login', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: mfaPending.tempToken,
        totpCode,
      }),
    });

    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }

    if (res.user) {
      setUser(formatUser(res.user));
      setMfaPending(null);
    }
  };

  const cancelMfa = () => {
    setMfaPending(null);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setCsrfToken(null);
      setMfaPending(null);
    }
  };

  // Demo mode role switcher for prototype evaluation as specified in SPEC Section 14.2
  const demoSwitchRole = (role: Role) => {
    if (role === 'STUDENT') {
      setUser({
        id: 'demo-student-user-id',
        email: '219x1a0501@gprec.ac.in',
        role: 'STUDENT',
        fullName: 'Sravya Reddy',
        registrationNumber: '219X1A0501',
        blockName: 'Arundhathi',
        roomNumber: 'A-101',
        studentId: 'demo-student-id',
      });
    } else if (role === 'WARDEN') {
      setUser({
        id: 'demo-warden-user-id',
        email: 'warden.gnbvg@gprec.ac.in',
        role: 'WARDEN',
        fullName: 'Dr. K. Anuradha (Chief Warden)',
      });
    } else {
      setUser({
        id: 'demo-admin-user-id',
        email: 'admin.hostel@gprec.ac.in',
        role: 'ADMIN',
        fullName: 'Hostel System Administrator',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        mfaPending,
        login,
        verifyMfa,
        cancelMfa,
        logout,
        setUserDirectly: (u) => setUser(u ? formatUser(u) : null),
        demoSwitchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
