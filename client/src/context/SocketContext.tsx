import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  activeSosCount: number;
  recentIntrusionCount: number;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { addToast } = useToast();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeSosCount, setActiveSosCount] = useState<number>(0);
  const [recentIntrusionCount, setRecentIntrusionCount] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Connect to WebSocket server with automatic reconnection
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[WEBSOCKET CONNECTED] Connected as ${user.email} (${user.role})`);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WEBSOCKET DISCONNECTED] Reason: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WEBSOCKET CONNECT ERROR]:', err.message);
      setIsConnected(false);
    });

    // 1. High-Priority SOS Triggered Event
    socket.on('sos:triggered', (payload: any) => {
      console.log('🚨 REAL-TIME SOS TRIGGERED:', payload);
      setActiveSosCount((prev) => prev + 1);

      addToast(
        'sos',
        `EMERGENCY SOS: ${payload.studentName} (${payload.registrationNumber})`,
        `Block ${payload.blockCode} Room ${payload.roomNumber} - Help needed immediately!`,
        10000
      );
    });

    // 2. SOS Updated (Acknowledge / Resolve)
    socket.on('sos:updated', (payload: any) => {
      if (payload.status === 'RESOLVED' || payload.status === 'FALSE_ALARM') {
        setActiveSosCount((prev) => Math.max(0, prev - 1));
      }
      addToast(
        'info',
        `SOS Alert ${payload.status}`,
        `Emergency alert #${payload.id?.slice(0, 8)} status updated to ${payload.status}.`
      );
    });

    // 3. Security Intrusion Detected Event (for Warden/Admin)
    socket.on('intrusion:detected', (payload: any) => {
      setRecentIntrusionCount((prev) => prev + 1);
      if (user.role === 'WARDEN' || user.role === 'ADMIN') {
        addToast(
          'error',
          'SECURITY INTRUSION BLOCKED',
          `Unauthorized registration attempt by non-hosteller: ${payload.attemptedName || payload.email}`,
          8000
        );
      }
    });

    // 4. Attendance Recorded Event
    socket.on('attendance:recorded', (payload: any) => {
      if (user.role === 'STUDENT') {
        addToast(
          'success',
          'Attendance Verified & Recorded!',
          `Verified successfully on ${payload.date} at ${payload.checkInTime ? new Date(payload.checkInTime).toLocaleTimeString() : 'now'}.`
        );
      }
    });

    // 5. Gate Pass Status Changed
    socket.on('gatepass:status_changed', (payload: any) => {
      addToast(
        'info',
        `Gate Pass ${payload.status}`,
        `Pass ${payload.passNumber} status updated to ${payload.status}.`
      );
    });

    // 6. New Safety Announcement Broadcast
    socket.on('announcement:new', (payload: any) => {
      addToast(
        'warning',
        `Announcement: ${payload.title}`,
        payload.content,
        8000
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user, addToast]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        activeSosCount,
        recentIntrusionCount,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
