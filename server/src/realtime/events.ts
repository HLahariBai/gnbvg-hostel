import { getSocketServer } from './socket.js';
import { Role } from '@prisma/client';

export interface SOSAlertEventPayload {
  id: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  blockCode: string;
  blockName: string;
  roomNumber: string;
  parentPhone?: string;
  latitude?: number | null;
  longitude?: number | null;
  triggerType: string;
  status: string;
  createdAt: string;
}

export interface AttendanceRecordedEventPayload {
  id: string;
  studentId: string;
  registrationNumber: string;
  studentName: string;
  blockCode: string;
  roomNumber: string;
  status: string;
  date: string;
  checkInTime: string;
  accuracyMeters: number;
}

export interface GatePassStatusEventPayload {
  id: string;
  passNumber: string;
  studentId: string;
  studentName: string;
  passType: string;
  destination: string;
  status: string;
  validUntil: string;
  updatedAt: string;
}

export interface IntrusionEventPayload {
  id: string;
  attemptedName?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  failureReason: string;
  status: string;
  attemptedAt: string;
}

export interface SafetyTicketEventPayload {
  id: string;
  ticketNumber: string;
  category: string;
  title: string;
  priority: string;
  status: string;
  isAnonymous: boolean;
  studentId?: string | null;
  createdAt: string;
}

export interface AnnouncementEventPayload {
  id: string;
  title: string;
  content: string;
  priority: string;
  targetBlockCodes: string;
  validUntil: string;
  createdAt: string;
}

/**
 * Real-Time Engine Broadcast Emitter.
 * Transmits structured WebSocket events to isolated recipient rooms.
 * MUST be invoked after database transactions succeed.
 */
export const realtimeEmitter = {
  /**
   * Broadcasts high-priority SOS emergency alert to Warden/Admin feed and the student's block channel.
   */
  emitSosTriggered(payload: SOSAlertEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    // 1. Emit to warden & admin central safety channel
    io.to('warden-admin-feed').emit('sos:triggered', payload);

    // 2. Emit to specific block channel
    io.to(`block:${payload.blockCode}`).emit('sos:triggered', payload);

    console.log(`[REALTIME BROADCAST] sos:triggered broadcast for student ${payload.registrationNumber} (Block ${payload.blockCode})`);
  },

  /**
   * Broadcasts status updates (Acknowledge / Resolve) on an active SOS alert.
   */
  emitSosUpdated(payload: Partial<SOSAlertEventPayload> & { id: string; status: string; studentId: string }): void {
    const io = getSocketServer();
    if (!io) return;

    io.to('warden-admin-feed').emit('sos:updated', payload);
    io.to(`student:${payload.studentId}`).emit('sos:updated', payload);

    console.log(`[REALTIME BROADCAST] sos:updated [${payload.id} -> ${payload.status}]`);
  },

  /**
   * Broadcasts verified attendance check-in.
   */
  emitAttendanceRecorded(payload: AttendanceRecordedEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    // Send confirmation to the student
    io.to(`student:${payload.studentId}`).emit('attendance:recorded', payload);

    // Update warden dashboard feed
    io.to('warden-admin-feed').emit('attendance:recorded', payload);

    // Update block room
    io.to(`block:${payload.blockCode}`).emit('attendance:recorded', payload);
  },

  /**
   * Broadcasts Gate Pass status changes (Approval, Rejection, Check-Out, Return).
   */
  emitGatePassStatusChanged(payload: GatePassStatusEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    // Private student notification
    io.to(`student:${payload.studentId}`).emit('gatepass:status_changed', payload);

    // Warden pass monitoring feed
    io.to('warden-admin-feed').emit('gatepass:status_changed', payload);
  },

  /**
   * Broadcasts unauthorized access or gatekeeper intrusion attempts.
   */
  emitIntrusionAlert(payload: IntrusionEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to('warden-admin-feed').emit('intrusion:detected', payload);
    console.log(`[REALTIME BROADCAST] intrusion:detected [${payload.registrationNumber || payload.email}]`);
  },

  /**
   * Broadcasts new safety incident ticket.
   */
  emitSafetyTicketCreated(payload: SafetyTicketEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to('warden-admin-feed').emit('ticket:created', payload);
  },

  /**
   * Broadcasts status change on safety incident ticket.
   */
  emitSafetyTicketUpdated(payload: SafetyTicketEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to('warden-admin-feed').emit('ticket:updated', payload);

    if (payload.studentId && !payload.isAnonymous) {
      io.to(`student:${payload.studentId}`).emit('ticket:updated', payload);
    }
  },

  /**
   * Broadcasts administrative safety announcements to target block or all students.
   */
  emitAnnouncementBroadcast(payload: AnnouncementEventPayload): void {
    const io = getSocketServer();
    if (!io) return;

    if (payload.targetBlockCodes === 'ALL') {
      io.to(`role:${Role.STUDENT}`).emit('announcement:new', payload);
      io.to('warden-admin-feed').emit('announcement:new', payload);
    } else {
      const blocks = payload.targetBlockCodes.split(',').map((b) => b.trim());
      for (const block of blocks) {
        io.to(`block:${block}`).emit('announcement:new', payload);
      }
      io.to('warden-admin-feed').emit('announcement:new', payload);
    }
  },
};
