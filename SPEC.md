# GNBVG Hostel Safety, Attendance & Student Movement Management System
## Technical Specification (SPEC.md)

### 1. System Overview & Deployment Profile
- **Institution:** G. Pulla Reddy Engineering College (Autonomous), Kurnool, Andhra Pradesh, India (**GPREC**)
- **Hostel:** G. Narayanamma Balikala Vasathi Gruham (**GNBVG**)
- **Target Population:** ~1,200 Female Resident Hostellers
- **Controlled Blocks:**
  - Block A: Arundhathi
  - Block B: Annapurna
  - Block C: Anuradha
- **Core Mission:** Secure, verified attendance and student movement management utilizing server-validated Face Recognition (FRS), presentation-attack liveness verification, GPS geofencing, duplicate prevention, SOS panic response, and digital gate pass lifecycles.

---

### 2. Role-Based Access Control (RBAC)
1. **STUDENT / RESIDENT:**
   - Initiate daily verified attendance within configured window.
   - Trigger Sticky Emergency SOS with immediate or 3-second auto-send.
   - Apply for Day Pass and Night Out Pass (Digital QR code).
   - Submit incident/maintenance reports (with anonymous option).
   - Access emergency calling directory and institutional announcements.
2. **WARDEN:**
   - Monitor real-time resident attendance (Hostel-wide, Block-wise, Room-wise).
   - Triage high-priority SOS alerts and track resolution.
   - Approve or reject Gate Passes and monitor active/overdue hostellers.
   - Log external visitors and maintain entry/exit audit.
   - Review and update safety and maintenance incident tickets.
3. **ADMINISTRATOR:**
   - Hosteller Master Registry management (bulk CSV upload, manual add, deactivation).
   - Annual academic year rollover without data loss.
   - Review and act upon Unauthorized Access / Intrusion Attempt feed.
   - System configuration: Geofence polygon coordinates, attendance windows, reminder intervals.
   - Access immutable system-wide audit logs and exportable reports.

---

### 3. Data Dictionary & Normalized Entities

#### 3.1 Master Data & Hierarchy
- **Hostel:** Master record for GNBVG including center coordinates, radius/polygon geofence boundary, timezone (`Asia/Kolkata`), attendance window defaults.
- **Block:** Master blocks (A-Arundhathi, B-Annapurna, C-Anuradha) linked to Hostel.
- **Room:** Room identifier (e.g. A-104), capacity, block reference, occupied status.

#### 3.2 Hosteller Whitelist & Registration Gatekeeper
- **HostellerRegistry:** Official whitelist pre-uploaded by Warden/Admin. Fields: Registration Number, College Email (`@gprec.ac.in`), Student Name, Block, Room. Authoritative gatekeeper for registration.
- **UnauthorizedAccessAttempt:** Captures blocked registration attempts (non-hosteller / registry mismatch) with Name, Reg No, Email, Phone, IP address, timestamp, and Warden triage status (`BLOCKED`, `ACKNOWLEDGED`, `FLAGGED_TO_PRINCIPAL`, `WHITELISTED`).

#### 3.3 Identity & Security
- **User:** Authentication identity with GPREC email, Argon2id password hash, role (`STUDENT`, `WARDEN`, `ADMIN`), account status (`ACTIVE`, `SUSPENDED`, `INACTIVE`), TOTP secret (optional for admins).
- **OTPChallenge:** Dual-channel 6-digit OTP, purpose (`REGISTRATION`, `PASSWORD_RESET`, `LOGIN_MFA`), cryptographically hashed OTP, expiry (5 min), resend cooldown (60 sec), attempt counter, verification state.
- **Session:** Active JWT refresh tokens, device signature, IP, user-agent, expiry, revocation state.
- **ParentGuardian:** Contact details (Father, Mother, Guardian). Conditional validation: If Father and Mother details are omitted, Guardian Name, Relation, and Phone are strictly mandatory.
- **Student:** Profile details including Registration Number, Academic Year (1st, 2nd, 3rd, 4th), Branch (CSE, ECE, EEE, MECH, CIVIL, CSM, CSD), Section (A-D), primary phone, secondary phone, permanent address, allocated Block and Room IDs.

#### 3.4 Biometrics & Attendance
- **FaceEnrollment:** Biometric reference metadata, model version, protected template embedding hash/storage ref, enrollment date, quality score.
- **Attendance:** Transactionally verified daily attendance record. Fields: studentId, date (derived server-side in Asia/Kolkata), checkInTime, latitude, longitude, accuracyMeters, insideGeofence, faceConfidence, livenessConfidence, status (`PRESENT`, `PENDING_REVIEW`, `REJECTED`, `DUPLICATE`, `NOT_GIVEN`), verificationMethod, verifiedById (if manual review), remarks. Unique constraint on `[studentId, date]`.
- **AttendanceAttempt:** Individual attempt log recording every try, stage failed (`GEO_LOCATION`, `GPS_ACCURACY`, `FACE_CAPTURE`, `LIVENESS`, `FACE_MATCH`, `WINDOW_CLOSED`), coordinates, raw score metrics.

#### 3.5 Movement & Passes
- **GatePass:** Day Pass or Night Out Pass request. Fields: passNumber, passType, destination, reason, validFrom, validUntil, parentConfirmationStatus, status (`PENDING`, `APPROVED`, `CHECKED_OUT`, `RETURNED`, `OVERDUE`, `REJECTED`), digital QR signature, approvedById, checkedOutAt, returnedAt.
- **MovementEvent:** Turnstile or warden gate checkpoint logging check-out and check-in against active GatePass.
- **VisitorLog:** External visitor recording: visitorName, idProofType, idProofNumber, studentId, blockId, roomId, checkInTime, checkOutTime, purpose, recordedById.

#### 3.6 Resident Safety & Support
- **SOSAlert:** Emergency panic trigger. Fields: studentId, blockId, roomId, latitude, longitude, triggerType (`INSTANT`, `COUNTDOWN_AUTO`), status (`TRIGGERED`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_ALARM`), acknowledgedById, acknowledgedAt, resolvedAt, resolutionNotes.
- **SafetyTicket:** Safety and maintenance complaints. Fields: ticketNumber, studentId (nullable if anonymous), isAnonymous, category (`LOCK_SECURITY`, `CCTV_FAULT`, `CORRIDOR_LIGHTING`, `UNAUTHORIZED_VISITOR`, `HARASSMENT_RAGGING`, `MAINTENANCE_OTHER`), description, status (`REPORTED`, `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`), assignedTo, resolutionSummary.
- **Announcement:** Broadcast safety notices and curfew alerts with target block filters and validity windows.

#### 3.7 Immutable Audit Logging
- **AuditLog:** Cryptographically traceable and immutable log recording actorId, actorRole, action, entityName, entityId, IP address, user-agent, previousState, newState, timestamp.

---

### 4. Cryptographic & Security Specifications
- **Transport Security:** TLS 1.3
- **Password Storage:** Argon2id with memory cost 64MB, time cost 3, parallelism 1
- **Payload Encryption:** AES-256-GCM with unique 96-bit IV per encryption operation
- **Data Integrity:** HMAC-SHA-256 for token signatures and QR code digital verification
- **Hashing:** SHA-256 for template integrity and OTP storage
- **Random Token Generation:** CSPRNG (Node.js `crypto.randomBytes`)
- **Query Parameterization:** Strictly enforced via Prisma ORM parameterized queries; raw dynamic SQL concatenation prohibited.
