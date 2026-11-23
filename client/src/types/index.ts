export type Role = 'STUDENT' | 'WARDEN' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  registrationNumber?: string;
  blockName?: string;
  roomNumber?: string;
  studentId?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  csrfToken: string | null;
}

export interface GeofenceConfig {
  code: string;
  name: string;
  centerLat: number;
  centerLng: number;
  geofenceRadiusMeters: number;
  attendanceStart: string;
  attendanceEnd: string;
  reminderIntervalMin: number;
}

export interface GeofenceTestResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  hostelCenterLat: number;
  hostelCenterLng: number;
  distanceMeters: number;
  geofenceRadiusMeters: number;
  insideGeofence: boolean;
  accuracyPassed: boolean;
  status: 'INSIDE_APPROVED_PERIMETER' | 'OUTSIDE_GEOFENCE' | 'ACCURACY_TOO_LOW';
  thresholdMeters: number;
}

export interface BlockSummary {
  id: string;
  code: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  _count?: {
    rooms: number;
    students: number;
  };
}

export interface RoomOccupancy {
  id: string;
  roomNumber: string;
  floorNumber: number;
  capacity: number;
  occupiedCount: number;
  isActive: boolean;
}

export interface BlockMatrix {
  blockId: string;
  blockCode: string;
  blockName: string;
  totalRooms: number;
  totalCapacity: number;
  totalOccupied: number;
  rooms: RoomOccupancy[];
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  insideGeofence: boolean;
  faceConfidence: number;
  livenessConfidence: number;
  status: 'PRESENT' | 'PENDING_REVIEW' | 'REJECTED' | 'DUPLICATE' | 'NOT_GIVEN';
  verificationMethod: string;
  remarks?: string;
  student?: {
    id: string;
    fullName: string;
    registrationNumber: string;
    collegeEmail: string;
    primaryPhone: string;
    branch?: string;
    section?: string;
    block: { code: string; name: string };
    room: { roomNumber: string };
  };
}

export interface AttendanceSummary {
  date: string;
  metrics: {
    totalStudents: number;
    presentToday: number;
    notGivenTotal: number;
    onLeaveToday: number;
    outOnPassToday: number;
    pendingReviewToday: number;
    turnoutPercentage: number;
  };
  blockStats: Array<{
    blockId: string;
    blockCode: string;
    blockName: string;
    totalResidents: number;
    presentCount: number;
    notGivenCount: number;
    percentage: number;
  }>;
}

export interface SOSAlert {
  id: string;
  studentId: string;
  studentName?: string;
  registrationNumber?: string;
  blockCode?: string;
  blockName?: string;
  roomNumber?: string;
  parentPhone?: string;
  latitude?: number | null;
  longitude?: number | null;
  triggerType: 'INSTANT' | 'COUNTDOWN_AUTO';
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM';
  resolutionNotes?: string;
  createdAt: string;
  acknowledgedAt?: string;
  student?: {
    fullName: string;
    registrationNumber: string;
    primaryPhone: string;
    block: { name: string; code: string };
    room: { roomNumber: string };
    parentGuardian?: {
      fatherPhone?: string;
      motherPhone?: string;
      guardianPhone?: string;
    };
  };
  block?: { code: string; name: string };
  room?: { roomNumber: string };
}

export interface GatePass {
  id: string;
  passNumber: string;
  studentId: string;
  passType: 'DAY_PASS' | 'NIGHT_OUT_PASS';
  destination: string;
  reason: string;
  validFrom: string;
  validUntil: string;
  parentConfirmed: boolean;
  status: 'PENDING' | 'APPROVED' | 'CHECKED_OUT' | 'RETURNED' | 'OVERDUE' | 'REJECTED';
  qrCodeSignature: string;
  checkedOutAt?: string;
  returnedAt?: string;
  createdAt: string;
  student?: {
    fullName: string;
    registrationNumber: string;
    primaryPhone: string;
    block: { code: string; name: string };
    room: { roomNumber: string };
  };
}

export interface LeaveRequest {
  id: string;
  leaveType: 'HOME_VISIT' | 'MEDICAL' | 'ACADEMIC' | 'EMERGENCY' | 'OTHER';
  reasonCategory: string;
  reasonDetails: string;
  fromDate: string;
  toDate: string;
  expectedReturnDate: string;
  parentConsentVerified: boolean;
  parentConsentMethod?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decisionRemarks?: string;
  createdAt: string;
  student?: {
    fullName: string;
    registrationNumber: string;
    block: { name: string };
    room: { roomNumber: string };
  };
}

export interface SafetyTicket {
  id: string;
  ticketNumber: string;
  studentId?: string | null;
  isAnonymous: boolean;
  category:
    | 'LOCK_SECURITY'
    | 'CCTV_FAULT'
    | 'CORRIDOR_LIGHTING'
    | 'UNAUTHORIZED_VISITOR'
    | 'HARASSMENT_RAGGING'
    | 'MAINTENANCE_OTHER';
  title: string;
  description: string;
  status: 'REPORTED' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'RESOLVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  resolutionSummary?: string;
  createdAt: string;
  student?: {
    fullName: string;
    registrationNumber: string;
    block: { name: string };
    room: { roomNumber: string };
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  targetBlockCodes: string;
  validUntil: string;
  createdAt: string;
}

export interface IntrusionAttempt {
  id: string;
  attemptedName?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  ipAddress?: string | null;
  attemptedAt: string;
  failureReason: string;
  status: 'BLOCKED' | 'ACKNOWLEDGED' | 'FLAGGED_TO_PRINCIPAL' | 'WHITELISTED';
  reviewNotes?: string;
}

export interface HostellerRegistryEntry {
  id: string;
  registrationNumber: string;
  collegeEmail: string;
  studentName: string;
  blockCode: string;
  roomNumber: string;
  academicYear: number;
  branch: string;
  section: string;
  isRegistered: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorRole: string;
  action: string;
  entityName: string;
  entityId?: string;
  ipAddress?: string;
  previousState?: string;
  newState?: string;
  timestamp: string;
  actor?: {
    email: string;
    role: string;
  };
}

export interface DashboardKPIs {
  date: string;
  kpis: {
    totalResidents: number;
    presentToday: number;
    notGivenToday: number;
    turnoutPercentage: number;
    activeSosCount: number;
    blockedIntrusionsCount: number;
    outOnPassCount: number;
    overduePassesCount: number;
    activeLeavesCount: number;
    openTicketsCount: number;
  };
}
