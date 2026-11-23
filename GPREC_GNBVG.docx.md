![Affiliation & Accreditation – GPREC \> G.Pulla Reddy Engineering College – Kurnool, AP, INDIA][image1]

Hostel Blocks: A – Arundhathi  \|  B – Annapurna  \|  C – Anuradha

**HOSTEL: GNBVG — G. NARAYANAMMA BALIKALA VASATHI GRUHAM**

**G. PULLA REDDY ENGINEERING COLLEGE (AUTONOMOUS), KURNOOL**

**GPREC**

**PROJECT REPORT**

**HOSTEL SAFETY, ATTENDANCE AND**  
**STUDENT MOVEMENT MANAGEMENT SYSTEM**

A Face Recognition, Geofencing, Authentication and Student Safety Management Solution

**Prepared as a technical project report**  
Target: Girls' hostel with approximately 1,200 residents  
Status: Backend foundation and student registration tested; attendance verification planned/in progress  
Date: 13 October 2026

# **Document Status and Important Note**

This report separates verified implementation from proposed design. The Express backend starts on port 4000, /api/health and /api/db-health have succeeded, a fictional student TEST001 was registered through the student API, and the initial Prisma migration created Hostel, Block, Room, and Student models.

The Attendance model/migration has not been confirmed complete. Geofence enforcement, face recognition, liveness detection, the Flutter app, and the warden portal are not verified as implemented; they are described as planned features.

# **Abstract**

The Hostel Safety, Attendance and Student Movement Management System is proposed for a girls' hostel with approximately 1,200 residents. It aims to let students initiate attendance from their rooms using a mobile application while requiring face verification and location validation against an approved hostel geofence. The server should accept attendance only after required checks pass and duplicate prevention is applied.

The proposed stack includes Flutter, React/Vite/Tailwind, Node.js/Express/TypeScript, PostgreSQL/Prisma, and Python/FastAPI/OpenCV for face verification. Planned capabilities include leave requests, outgoing and return tracking, overdue alerts, room-wise monitoring, annual student rollover, bulk import, reports, notifications, and audit logs. GPS can drift indoors and can be spoofed; it cannot reliably prove room-level presence. Accuracy rules, liveness safeguards, server-side checks, privacy protections, and a supervised exception process are therefore required.

Keywords: Hostel management, FRS, face verification, liveness detection, GPS geofencing, student movement, PostgreSQL, Flutter, Express.js, FastAPI, RBAC.

# **Contents**

* 1\. Introduction and problem statement  
* 2\. Aim, objectives and scope  
* 3\. Requirements  
* 4\. System architecture  
* 5\. Modules and workflow  
* 6\. Geofencing and face verification  
* 7\. Database and APIs  
* 8\. Security and privacy  
* 9\. Implementation status  
* 10\. Testing and deployment  
* 11\. Risks and future work  
* 12\. Conclusion and appendices

# **1\. Introduction and Problem Statement**

Hostel administration includes attendance, student identification, leave approvals, departure/return entries, room allocation, and follow-up when residents have not returned. Paper registers and fragmented messaging can cause delays, duplicate entries, incomplete records, and weak real-time visibility.

The proposed system centralizes student data and movement records. Its primary attendance mechanism combines face verification with a GPS geofence for the hostel premises. The server validates each attempt, prevents duplicate attendance, and provides authorized wardens with attendance and exception information.

# **2\. Aim, Objectives and Scope**

## **2.1 Aim**

To design and implement a secure hostel attendance and student movement system in which attendance is accepted only after required face verification and hostel-geofence checks.

## **2.2 Objectives**

* Provide a student mobile app for login, attendance, leave requests, and return confirmation.  
* Verify identity using an enrolled face reference and liveness safeguards.  
* Validate reported location against an approved hostel boundary with accuracy and freshness rules.  
* Prevent duplicate attendance for a student and attendance date.  
* Provide a warden dashboard for verified attendance, missing check-ins, leave, outgoing, returned, and overdue residents.  
* Support bulk import and annual academic-year updates for about 1,200 residents.  
* Maintain role-based access, audit trails, exception handling, and reports.

## **2.3 Scope**

In scope: student management, face enrollment/verification, GPS geofencing, attendance, leave approval, movement tracking, warden dashboard, alerts, reports, bulk import, and annual rollover. The current prototype is not production-ready; automated decisions must not be treated as proof of misconduct, and GPS alone must not be described as room-level proof.

# **3\. Requirements**

## **3.1 Functional requirements**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| FR-01 | Student management | Create, view, update, deactivate and bulk-import records. |
| FR-02 | Authentication | Authenticate students/staff and enforce role permissions. |
| FR-03 | Face verification | Compare a fresh capture with an enrolled reference. |
| FR-04 | Liveness | Check for photo/video presentation attacks using an evaluated method. |
| FR-05 | Geofence | Configure hostel boundary and validate coordinates server-side. |
| FR-06 | Attendance | Record attendance only after mandatory checks pass. |
| FR-07 | Duplicate prevention | Enforce a unique record for the attendance period. |
| FR-08 | Leave/movement | Approve leave and record departure/return. |
| FR-09 | Safety dashboard | Show attendance, leave, outgoing, returned, and overdue lists. |
| FR-10 | Reports/audit | Generate summaries and record sensitive administrative actions. |
| FR-11 | Annual rollover | Update academic year and room while preserving history. |

## **3.2 Non-functional requirements**

* Scalability for approximately 1,200 residents and peak check-in periods.  
* Security through TLS, password hashing, RBAC, rate limiting, validation, and least privilege.  
* Privacy through data minimization, access restrictions, retention/deletion rules, and appropriate consent/legal basis.  
* Reliability through transactions, database constraints, backups, monitoring, and safe error handling.  
* Usability through clear failure reasons, retry, and supervised exceptions.  
* Auditability without logging secrets or unnecessary raw biometric/location data.

# **4\. System Architecture**

| Layer | Technology | Responsibilities |
| :---- | :---- | :---- |
| Student client | Flutter | Login, location/selfie capture, attendance, leave and return. |
| Warden/admin portal | React, Vite, Tailwind | Student administration, dashboard, approvals, reports. |
| Backend API | Node.js, Express, TypeScript | Authentication, validation, geofence rules, attendance orchestration. |
| Database | PostgreSQL, Prisma | Student, hostel, room, attendance, leave, movement and audit data. |
| Face service | Python, FastAPI, OpenCV plus selected model | Face quality, matching, liveness and safe verification result. |
| Notifications | Firebase Cloud Messaging (planned) | Push alerts for decisions and overdue returns. |

Logical flow: Flutter app \-\> Express API \-\> authentication and request validation \-\> geofence check \-\> face/liveness service \-\> attendance policy \-\> PostgreSQL transaction \-\> response to app and authorized warden dashboard.

The server must not trust a client-supplied flag such as faceVerified=true. It must perform or independently validate checks and bind each attempt to the authenticated student and a short-lived request.

# **5\. Modules and Attendance Workflow**

## **5.1 Student management**

Stores student number, name, academic year, active status, and optional room assignment. Supports duplicate checks and planned bulk import.

## **5.2 Face enrollment and verification**

Creates a reference through a controlled process, checks a fresh capture, and uses a selected model with evaluated thresholds.

## **5.3 Geofence management**

Authorized staff configure a radius or polygon. The server evaluates coordinates, reported accuracy, freshness, and boundary inclusion.

## **5.4 Attendance management**

Coordinates required checks, enforces policy, prevents duplicates, and stores timestamped outcomes.

## **5.5 Leave and movement**

Students request leave; wardens approve/reject. Departure and return events are linked where policy requires.

## **5.6 Warden dashboard**

Shows attendance given/not given, approved leave, outgoing, returned, overdue students, and exceptions.

## **5.7 Alerts and reports**

Flags missed check-ins and overdue returns, and produces daily/monthly and room-wise summaries.

## **5.8 Attendance sequence**

1. Student signs in and starts attendance during the configured window.  
2. App obtains a current location sample with accuracy and capture time.  
3. API validates identity/session, request freshness, attendance window, and geofence.  
4. Face service checks image quality, matching, and liveness.  
5. API applies policy and checks for an existing record for the student/date.  
6. If all mandatory checks pass, the server writes the record transactionally.  
7. App receives success or a clear failure reason; authorized wardens see the result.  
8. If a check is inconclusive, the app offers a retry or documented supervised review.

## **5.9 Attendance states**

| State | Meaning |
| :---- | :---- |
| PRESENT | All mandatory checks passed and attendance was accepted. |
| PENDING\_REVIEW | Automated checks are inconclusive or an exception was requested. |
| REJECTED | A mandatory check failed; not counted as successful attendance. |
| DUPLICATE | A record already exists for the configured period. |

# **6\. Geofencing and Face Verification**

## **6.1 Geofencing**

* Configure an approved hostel center/radius or polygon.  
* Reject missing, non-finite, or out-of-range coordinates.  
* Apply an accuracy threshold and request retry/review for poor accuracy.  
* Check location freshness and rate-limit attempts.  
* Use device-integrity signals where available, recognizing that spoofing cannot be eliminated completely.  
* Avoid continuous tracking; retain only location data necessary for attendance and approved audit purposes.

GPS commonly has reduced precision indoors and cannot reliably distinguish rooms. Geofencing supports a hostel-premises check, not definitive room-level presence. Stronger room-level assurance would require additional approved on-premises signals.

## **6.2 Face matching and liveness**

Enrollment should confirm identity, explain biometric processing, and capture a suitable reference. Store the minimum necessary representation with protection and retention controls. Verification should detect a face, check quality, compare with the enrolled reference, and apply a threshold based on testing. Liveness attempts to distinguish a live person from a photo or screen replay; face detection alone is insufficient.

* Measure false acceptance and false rejection rates on representative devices.  
* Test lighting, camera variation, glasses and other realistic conditions.  
* Test authorized photo/screen-replay scenarios.  
* Provide an accessible human review or alternative process when verification fails.  
* Do not claim the system is infallible.

# **7\. Database and API Design**

| Entity | Purpose |
| :---- | :---- |
| Hostel | Hostel identity and geofence configuration. |
| Block | Block name and hostel relationship. |
| Room | Room number, capacity, and block relationship. |
| Student | Student number, name, academic year, optional room and timestamps. |
| Attendance (proposed) | Student, date/time, coordinates, reported accuracy, verification outcomes, status; unique student/date. |
| FaceEnrollment (planned) | Protected reference metadata, model version, enrollment and policy status. |
| LeaveRequest (planned) | Student, dates, reason category, status, approver and decision time. |
| MovementEvent (planned) | Departure/return event, timestamp, linked leave, actor/source. |
| User/Role (planned) | Authentication identity, role and account status. |
| AuditLog (planned) | Actor, action, target, timestamp and outcome. |

| Method/path | Purpose | Status |
| :---- | :---- | :---- |
| GET /api/health | Backend health | Tested |
| GET /api/db-health | Database health | Tested |
| GET /api/students | List students | Tested |
| POST /api/students | Register student | Tested |
| GET/POST /api/blocks | List/create blocks | Code supplied; unverified |
| GET /api/rooms | List rooms | Code supplied; unverified |
| POST /api/blocks/:blockId/rooms | Create room | Code supplied; unverified |
| POST /api/students/:studentId/room | Allocate room | Code supplied; unverified |
| POST /api/attendance/attempts (proposed) | Start secure attendance attempt | Not implemented |
| GET /api/attendance/today (planned) | Daily attendance summary | Not implemented |

Use foreign keys, unique constraints, transactions, and restrictive deletion rules. The attendance date must be derived on the server using the hostel's configured timezone.

# **8\. Security and Privacy**

* Implement student, warden, and administrator authentication and API-level role-based authorization.  
* Use TLS outside local development and suitable password hashing; never store plaintext passwords.  
* Protect biometric templates and restrict face-service access.  
* Do not log passwords, tokens, raw face images, or unnecessary precise location data.  
* Define notice, appropriate consent/legal basis, retention/deletion rules, and an accessible exception process.  
* Use least-privilege database credentials, keep .env out of source control, encrypt backups, and test restoration.  
* Audit sensitive changes and avoid using automated flags as sole grounds for disciplinary action.

Current development CORS is permissive and authentication is not confirmed. This is acceptable only for local prototype testing. Restrict origins and add authorization before deployment.

# **9\. Implementation Status**

| Component | Status | Evidence / next step |
| :---- | :---- | :---- |
| Express server | Working | Started on port 4000\. |
| PostgreSQL connection | Working | /api/db-health returned connected. |
| Initial Prisma migration | Completed | Hostel, Block, Room, Student models. |
| Student registration/list | Tested | TEST001 registered successfully. |
| Block/room routes | Unverified | Code provided; must be tested. |
| Attendance schema/migration | Not confirmed | Check schema and run validation/migration. |
| Geofence logic | Not implemented | Configure boundary and server checks. |
| Face/liveness service | Not implemented | Select and evaluate model. |
| Flutter app | Not started | Build after API contracts are stable. |
| Warden portal | Not started | Build after authentication and attendance APIs. |
| Production security | Incomplete | Implement authentication, RBAC, audit and deployment controls. |

# **10\. Testing and Deployment**

## **10.1 Test plan**

* Register and retrieve a fictional student; test duplicate student numbers.  
* Test geofence inside/outside points, boundaries, invalid coordinates, stale samples and poor accuracy.  
* Test face-match thresholds, liveness failure and safe rejection.  
* Verify outside-geofence or failed-face attempts cannot create successful attendance.  
* Send concurrent attendance attempts and verify only one record per student/date.  
* Test missing permissions, network/database outages, access control and audit events.  
* Load-test synthetic data for approximately 1,200 residents and peak check-in periods; measure before claiming performance.

## **10.2 Deployment stages**

9. Local development using fictional data.  
10. Isolated test environment and test accounts.  
11. Small approved pilot to measure GPS and face performance.  
12. Security/privacy review, threshold tuning and exception testing.  
13. Production deployment behind HTTPS with managed secrets, backups, monitoring and incident response.  
14. Ongoing annual rollover, role review, backup restoration tests and retention controls.

# **11\. Risks and Future Enhancements**

| Risk | Mitigation |
| :---- | :---- |
| Indoor GPS drift | Accuracy threshold, retry, pilot testing, supervised exception. |
| GPS spoofing | Server-side checks, freshness, integrity signals and anomaly review; residual risk remains. |
| Face false rejection | Model evaluation, capture guidance, retry and human review. |
| Presentation attack | Evaluated liveness method; do not claim perfect detection. |
| Biometric exposure | Minimize data, protect templates, strict access and retention limits. |
| Network outage | Clear status and documented exception; never silently accept unverified attendance. |
| Duplicate/concurrent requests | Database unique constraint, transaction and idempotent design. |
| Unauthorized access | Strong authentication, RBAC, audit and least privilege. |

* Bulk spreadsheet import and annual rollover.  
* Room capacity visualization and room-wise attendance.  
* Push notifications for leave decisions and overdue return.  
* Hostel Safety View with present, absent, on-leave, outgoing, returned and overdue counts.  
* Daily/monthly reports, analytics and multi-hostel support.  
* Additional approved on-premises signals if room-level assurance is required.

# **12\. Conclusion**

The system aims to reduce manual effort and improve hostel visibility through centralized student data, face verification, geofence validation, attendance recording, and movement tracking. The server should record attendance only after the required checks, rather than trusting client-provided success flags.

Verified progress includes a working Express backend, PostgreSQL connection, initial Prisma migration, and tested student registration/listing. The immediate next task is to confirm and migrate the Attendance model, then implement server-side geofencing, face/liveness verification, attendance orchestration, and the Flutter and warden interfaces. Production deployment should wait for security, privacy, reliability, and operational testing.

# **Appendix A: Development Commands**

Backend folder:

cd C:\\Users\\hlaha\\Documents\\hostel-safety-system\\apps\\backend

Start API:

npx tsx src/server.ts

Health checks:

Invoke-RestMethod http\://localhost:4000/api/health  
Invoke-RestMethod http\://localhost:4000/api/db-health

Student list:

Invoke-RestMethod http\://localhost:4000/api/students

Only after confirming the Attendance schema:

npx prisma format  
npx prisma validate  
npx prisma migrate dev \--name add\_attendance  
npx prisma generate

# **Appendix B: Abbreviations**

| Term | Meaning |
| :---- | :---- |
| API | Application Programming Interface |
| FRS | Face Recognition System |
| GPS | Global Positioning System |
| RBAC | Role-Based Access Control |
| TLS | Transport Layer Security |
| ORM | Object-Relational Mapping |
| FCM | Firebase Cloud Messaging |
| MFA | Multi-Factor Authentication |
| PII | Personally Identifiable Information |

# **13\. Institutional and Hostel Deployment Profile**

This section updates the project from a generic girls' hostel prototype into a deployment-specific specification for G. Pulla Reddy Engineering College (GPREC), Kurnool and GNBVG.

| Item | Project-Specific Detail |
| :---- | :---- |
| Organization | G. Pulla Reddy Engineering College (Autonomous), Kurnool (GPREC) |
| Hostel | GNBVG — G. Narayanamma Balikala Vasathi Gruham |
| Hostel Type | Girls' hostel |
| Primary System Purpose | Hostel attendance, safety, authentication, student movement and warden monitoring |
| Attendance Priority | Face Recognition \+ Liveness \+ GPS Geofencing \+ Duplicate Prevention |
| Target Scale | Approximately 1,200 residents |
| Block A | Arundhathi |
| Block B | Annapurna |
| Block C | Anuradha |

## **13.1 Block and Hostel Mapping**

| Block Code | Block Name | Use in System |
| :---- | :---- | :---- |
| A | Arundhathi | Hosteller allocation, room directory, attendance and movement filtering |
| B | Annapurna | Hosteller allocation, room directory, attendance and movement filtering |
| C | Anuradha | Hosteller allocation, room directory, attendance and movement filtering |

The hostel block must be stored as a controlled master-data value. Every student record, room allocation, attendance record, gate-pass record, movement event, SOS event and warden dashboard filter must be traceable to the student's allocated block and room.

## **13.2 Institutional Identity and Branding**

* Organization branding: GPREC.  
* Hostel branding: GNBVG — G. Narayanamma Balikala Vasathi Gruham.  
* The final production interface should use the official GPREC logo/emblem supplied by the institution.  
* The report includes a clearly marked logo placement area because an official logo image was not supplied with the uploaded report.  
* The official GPREC website identifies the institution as G. Pulla Reddy Engineering College in Kurnool. citeturn428272search0

# **14\. Core Aesthetic, Interface and Role-Based Navigation**

## **14.1 Design Language**

| Design Element | Specification |
| :---- | :---- |
| Overall vibe | Trustworthy, clean, modern and calming |
| Primary color | Deep Navy \#0F172A |
| Secondary color | Slate Gray |
| Cards/background | Crisp white cards |
| Safe / Verified / Active | Emerald Green |
| Pending | Amber |
| SOS / Intrusion | High-contrast Crimson Red |
| Student experience | Mobile-first |
| Warden/Admin experience | Rich desktop dashboard |

## **14.2 Role-Based Modes**

* Authentication / Registration Portal — login, registration, OTP verification and password recovery.  
* Student / Resident View — attendance, SOS, gate passes, leave/movement, safety reporting and emergency contacts.  
* Warden / Admin View — live attendance, resident directory, approvals, SOS response, intrusion monitoring, visitor logs, reports and master registry.  
* A demo mode switcher may be provided during prototype evaluation to move instantly between the three views.

# **15\. GPREC Institutional Authentication and Hosteller Verification**

## **15.1 Official Institutional Email Enforcement**

* Registration and login shall accept only official GPREC email addresses ending with @gprec.ac.in.  
* Examples: 229x1a0501@gprec.ac.in.  
* Personal domains such as @gmail.com and @yahoo.com shall be rejected.  
* The validation must be enforced on both client and server sides; server-side enforcement is authoritative.

## **15.2 Hosteller Master Registry and Registration Gatekeeper**

The Warden/Admin Hosteller Master Registry is the authoritative whitelist of eligible residents. It must contain, at minimum, Registration Number, College Email, Student Name, Block and Room.

15. Student enters registration number and official GPREC email.  
16. Backend validates the email domain.  
17. Backend cross-checks Registration Number \+ @gprec.ac.in email against the Hosteller Master Registry.  
18. If matched, the student proceeds to OTP verification.  
19. If not matched, registration is blocked immediately.  
20. The failed attempt is recorded in an Unauthorized Access Attempts feed.

Required blocked-registration message: “Access Denied: Your details are not listed in the official GPREC Hostel Resident Registry.”

## **15.3 Unauthorized Access Attempt Record**

| Field | Required Value |
| :---- | :---- |
| Name | Attempted student name |
| Registration Number | Entered college registration number |
| Email ID | Entered email |
| Phone Number | Entered phone |
| Timestamp | Server-generated timestamp |
| Status | Blocked \- Non-Hosteller |
| Dashboard action | Acknowledge / Flag to Principal/Admin / Add to Whitelist |

## **15.4 Dual-Channel OTP**

* Generate a 6-digit OTP.  
* OTP expiry: 5 minutes.  
* Resend cooldown: 60 seconds.  
* Send through the student's registered @gprec.ac.in email and primary phone/SMS channel.  
* OTP must be single-use and stored only in protected/hashed form.  
* Rate-limit repeated OTP generation and verification attempts.

## **15.5 Forgot Password**

21. Student enters official GPREC email or registered primary phone.  
22. System verifies that the account belongs to an active registered hosteller.  
23. System sends a 6-digit OTP through the approved verification channel.  
24. After successful OTP validation, the student may create a new password.

Password policy: minimum 8 characters with uppercase, lowercase, number and special character. Passwords shall never be stored in plaintext; Argon2id is the preferred password hashing mechanism.

## **15.6 Demo Testing Data**

* Display two sample pre-whitelisted GPREC students for prototype testing.  
* Provide a simulated on-screen OTP toast so the prototype can be tested without a live SMS/email dependency.  
* Display one sample non-hosteller ID to demonstrate registration blocking and the intrusion alert workflow.  
* Demo records must be clearly marked as synthetic/test data and must not contain real student personal data.

# **16\. Student Registration and Resident Profile**

## **16.1 Exact Registration Fields**

| No. | Field | Validation / Requirement |
| :---- | :---- | :---- |
| 1 | Student Full Name | As per college record; required |
| 2 | Registration Number | Required; auto-uppercase |
| 3 | College Email ID | Required; must end with @gprec.ac.in |
| 4 | Year | 1st, 2nd, 3rd, 4th Year; required |
| 5 | Branch | CSE, ECE, EEE, MECH, CIVIL, CSM, CSD; required |
| 6 | Section | A, B, C, D; required |
| 7 | Primary Phone Number | 10-digit mobile; mandatory; OTP and SOS |
| 8 | Secondary Phone Number | 10-digit mobile; optional |
| 9 | Father Details | Father's Name \+ Phone |
| 10 | Mother Details | Mother's Name \+ Phone |
| 11 | Guardian Details | Name \+ Relationship \+ Phone; conditional |
| 12 | Permanent Home Address | Full residential address; required |
| 13 | Hostel Block | Block A / Block B / Block C; required |
| 14 | Room Number | Example A-104 / B-208; required |

## **16.2 Parent/Guardian Conditional Validation**

* If Father's Name \+ Father's Phone OR Mother's Name \+ Mother's Phone is supplied, Guardian details remain optional.  
* If both Father and Mother details are left empty, Guardian Name, Relationship and Guardian Phone automatically become mandatory.  
* The same validation must be enforced at the backend to prevent client-side bypass.

# **17\. Primary Attendance Mechanism — Face Recognition \+ Geofencing**

Attendance is the highest-priority operational function of the system. The system is designed so that a student can initiate attendance from a mobile phone, but attendance is accepted only when the required identity and hostel-premises checks succeed. The uploaded report already defines this as the primary attendance mechanism. fileciteturn0file0L40-L50

## **17.1 Attendance Preconditions**

| Check | Required Condition | Failure Result |
| :---- | :---- | :---- |
| Authenticated account | Active registered hosteller | Reject / login required |
| Attendance window | Attempt occurs within warden-configured period | Reject / wait for window |
| Hostel geofence | Current location inside approved hostel boundary | Reject / retry or review |
| GPS quality | Acceptable accuracy and fresh timestamp | Retry / supervised review |
| Face capture | Fresh face image of enrolled student | Reject / retry |
| Liveness | Live-person check passes | Reject / retry / review |
| Face match | Similarity passes tested threshold | Reject / retry / review |
| Duplicate check | No accepted attendance for configured period | DUPLICATE |
| Server validation | All mandatory rules independently validated | No client-only acceptance |

## **17.2 Recommended Attendance Workflow**

25. Student signs in using the authenticated GPREC hosteller account.  
26. Student starts attendance during the configured attendance window.  
27. The app obtains a fresh GPS location sample and records accuracy and capture time.  
28. Backend validates session, student identity, request freshness and attendance window.  
29. Backend validates the reported location against the approved GNBVG geofence.  
30. Face service checks image quality and detects a face.  
31. Liveness verification checks that the capture is from a live person rather than a photo/screen replay.  
32. Face matching compares the fresh capture with the student's enrolled reference.  
33. Backend checks for an existing attendance record for the student and configured period.  
34. If all mandatory checks pass, the backend writes attendance transactionally.  
35. Student receives a clear success/failure response and the authorized warden dashboard is updated.  
36. If a check is inconclusive, the student receives a retry option or a documented supervised-review path.

## **17.3 Attendance Window and Reminder Mechanism**

* Warden/Admin can configure the attendance start time and end time.  
* Example operating window: 5:00 PM–7:00 PM; this is a configurable example, not a fixed institutional rule.  
* The student app can provide a reminder/beep at configurable intervals during the attendance period when attendance has not yet been successfully recorded.  
* A 15-minute reminder interval may be used as the prototype default, with the ability for the warden to change the interval.  
* The reminder mechanism must stop once attendance is successfully recorded or the attendance window closes.  
* The system should show status such as Not Given, In Progress, Verified, Failed, Pending Review and Present.

## **17.4 Attendance States**

| State | Meaning |
| :---- | :---- |
| PRESENT | All mandatory checks passed and attendance was accepted. |
| PENDING\_REVIEW | Automated checks are inconclusive or an exception is requested. |
| REJECTED | A mandatory check failed; attendance is not counted as successful. |
| DUPLICATE | A record already exists for the configured attendance period. |
| NOT\_GIVEN | No successful attendance has been recorded within the configured window. |
| IN\_PROGRESS | Student has initiated verification but the workflow is not complete. |

## **17.5 Warden Attendance View**

* Total residents.  
* Attendance given / not given.  
* Block-wise attendance: Arundhathi, Annapurna and Anuradha.  
* Room-wise attendance.  
* Year-wise and branch-wise filters.  
* Failed verification attempts.  
* Pending review cases.  
* Duplicate attempts.  
* Late/missed attendance alerts.  
* Exportable daily and monthly reports.

## **17.6 Attendance Security Rules**

* Never trust a client-supplied flag such as faceVerified=true.  
* Server must independently validate geofence and attendance policy.  
* Attendance date must be derived by the server using the hostel's configured timezone.  
* Use database unique constraints and transactions to prevent concurrent duplicate records.  
* Do not continuously track students solely for attendance; retain only the minimum location information necessary for the attendance and approved audit purpose.  
* GPS confirms hostel-premises presence, not definitive room-level presence; indoor GPS drift and spoofing remain risks. fileciteturn0file0L233-L244

# **18\. Student / Resident Safety Features**

## **18.1 Sticky Emergency SOS Panic Button**

* Prominent pulsing “SOS EMERGENCY” button available throughout the student interface.  
* Confirmation modal with either immediate send or a 3-second auto-trigger countdown.  
* Record student Name, Registration Number, Block, Room, parent contact, timestamp and simulated/available floor or GPS location.  
* Create a live alert in the Warden/Admin dashboard.  
* Provide acknowledgement and response status.  
* SOS must remain accessible even when the student is navigating between attendance, passes and safety-report screens.

## **18.2 Digital Gate Pass and Late-Night Check-In/Out**

* Pass types: Day Pass and Night Out Pass.  
* Capture destination, reason, expected return time and parent confirmation status.  
* Generate a digital QR code pass.  
* Pass lifecycle: Pending → Approved → Checked Out → Returned.  
* Warden can approve/reject and monitor active passes.  
* Overdue return events feed the alert and monitoring system.

## **18.3 Anonymous Incident and Maintenance Reporting**

* Report broken locks, faulty CCTV, poor corridor lighting, unauthorized visitors, ragging/harassment and other safety hazards.  
* Provide “Submit Anonymously” toggle.  
* Ticket lifecycle: Reported → Under Review → Resolved.  
* Warden/admin can update ticket status and retain an audit trail.

## **18.4 Safety Noticeboard and Emergency Directory**

* Dynamic announcements such as “Main Gate closes at 8:30 PM” and “Fire Safety Drill on Saturday”.  
* One-tap call options for Chief Warden, GPREC Campus Security, Women's Helpline 181, Local Police 112, Ambulance 108 and nearest hospital.  
* Emergency contact numbers should be configurable by authorized administrators rather than hard-coded for production.

# **19\. Warden and Admin Live Safety Dashboard**

## **19.1 Security Intrusion Alert Feed**

* Prominent red warning section for blocked non-hosteller registration attempts.  
* Display Name, Registration Number, Email, Phone and Timestamp.  
* Actions: Acknowledge, Flag to Principal/Admin, Add to Whitelist for authorized late admissions.  
* Maintain an audit record of every administrative action.

## **19.2 Hosteller Master List Manager**

* Add individual hosteller records.  
* Bulk-import CSV records.  
* Update block and room allocation.  
* Deactivate residents while preserving historical attendance/movement records.  
* Annual academic-year rollover without deleting historical records.

## **19.3 Real-Time KPI Cards**

| KPI | Meaning |
| :---- | :---- |
| Verified Residents Checked-In | Residents who successfully completed the configured attendance process |
| Active Gate Passes Outside | Students currently outside under an approved active pass |
| Open Safety Tickets | Incident/maintenance reports not yet resolved |
| Active SOS Alerts | SOS events awaiting response |
| Blocked Intrusion Attempts | Blocked non-hosteller/unauthorized registration attempts |

## **19.4 Live SOS Response Feed**

* Audible/visual alert for new SOS.  
* Show student and parent phone numbers to authorized responders.  
* Display block, room, timestamp and available location information.  
* Provide “Mark Responded” action and response timestamp.

## **19.5 Gate Pass Approval and Visitor Log**

* Approve/reject passes in real time.  
* Log external visitors: Visitor Name, ID Proof, Visiting Student, Room, Block, Time In and Time Out.  
* Filter resident directory by Block, Year and Branch.  
* Show overdue pass returns and unresolved visitor entries.

# **20\. Expanded Data Model**

| Entity | Key Data / Purpose |
| :---- | :---- |
| Hostel | GNBVG identity, timezone and geofence configuration |
| Block | A-Arundhathi, B-Annapurna, C-Anuradha |
| Room | Room number, capacity, block relationship |
| Student | Name, registration number, email, academics, phones, address, block, room, status |
| Parent/Guardian | Parent/guardian contact information and conditional relationship data |
| HostellerRegistry | Official whitelist used by registration gatekeeper |
| User/Role | Authentication identity, Student/Warden/Admin role and account status |
| OTPChallenge | Protected, single-use, expiring OTP metadata and rate-limit state |
| FaceEnrollment | Protected biometric reference metadata, model version and policy status |
| Attendance | Student, date/time, location metadata, verification outcomes and status |
| AttendanceAttempt | Individual attempt, failure reason, freshness and verification stages |
| LeaveRequest | Dates, reason category, status, approver and decision time |
| MovementEvent | Departure/return event, timestamp, linked pass/leave and actor/source |
| GatePass | Day/Night pass, destination, reason, return time, QR status |
| VisitorLog | Visitor identity, ID proof, student, room, block, in/out timestamps |
| SOSAlert | Student, parent contact, time, block, room, location, response state |
| SafetyTicket | Incident category, anonymous flag, description, status and audit |
| Announcement | Safety notices and emergency communications |
| UnauthorizedAccessAttempt | Blocked registration details and dashboard action status |
| AuditLog | Actor, action, target, timestamp and outcome |

# **21\. Expanded API and Service Design**

| Endpoint / Service | Purpose | Status / Phase |
| :---- | :---- | :---- |
| GET /api/health | Backend health | Existing / tested |
| GET /api/db-health | Database health | Existing / tested |
| GET /api/students | List students | Existing / tested |
| POST /api/students | Register student | Existing / tested |
| GET/POST /api/blocks | List/create blocks | Existing plan / verify |
| GET /api/rooms | List rooms | Existing plan / verify |
| POST /api/blocks/:blockId/rooms | Create room | Existing plan / verify |
| POST /api/students/:studentId/room | Allocate room | Existing plan / verify |
| POST /api/auth/register | Validated registration gatekeeper | Proposed |
| POST /api/auth/login | Institutional login | Proposed |
| POST /api/auth/otp/verify | OTP verification | Proposed |
| POST /api/auth/otp/resend | OTP resend with cooldown | Proposed |
| POST /api/auth/forgot-password | Password recovery | Proposed |
| POST /api/attendance/attempts | Start secure attendance attempt | Next priority |
| POST /api/attendance/verify-location | Server-side geofence validation | Proposed |
| POST /api/attendance/verify-face | Face/liveness result integration | Proposed |
| GET /api/attendance/today | Daily attendance summary | Proposed |
| POST /api/sos | Create SOS alert | Proposed |
| POST /api/gate-passes | Create pass | Proposed |
| PATCH /api/gate-passes/:id | Approve/reject/status update | Proposed |
| POST /api/safety-tickets | Create safety report | Proposed |
| GET /api/warden/dashboard | Live KPI and monitoring data | Proposed |
| GET /api/intrusion-attempts | Unauthorized attempt feed | Proposed |

# **22\. Security Architecture Standards**

| Security Requirement | Protocol / Algorithm / Control |
| :---- | :---- |
| Website/API communication | TLS 1.3 |
| Password storage | Argon2id |
| Sensitive data encryption | AES-256-GCM where application-level encryption is required |
| Message authentication | HMAC-SHA-256 where integrity/authentication of messages is required |
| Cryptographic hashing | SHA-256 for suitable non-password hashing use cases |
| Digital signatures | ECDSA P-256 where signatures are required |
| Random token generation | Cryptographically Secure Random Number Generator (CSPRNG) |
| Additional login security | TOTP MFA may be used for privileged Warden/Admin accounts |
| OTP | 6-digit, short-lived, single-use, hashed/protected, rate-limited |
| Authorization | Role-Based Access Control (RBAC) and least privilege |
| Biometric protection | Protected face reference metadata/templates; restricted face-service access |
| Audit | Immutable/auditable records of sensitive administrative actions |

## **22.1 RBAC Roles**

| Role | Core Permissions |
| :---- | :---- |
| Student / Resident | Own profile, own attendance, leave/pass requests, SOS, safety reports and own movement |
| Warden | Resident monitoring, attendance review, leave/pass approvals, SOS response, safety tickets, visitor logs |
| Admin | Master registry, user/role management, system configuration, reports, audit and authorized whitelist changes |

## **22.2 Security Logging Rules**

* Never log plaintext passwords, OTP values, authentication tokens or raw face images.  
* Minimize precise location logging and retain only what is necessary for attendance/audit requirements.  
* Record sensitive administrative actions with actor, timestamp, target and outcome.  
* Protect .env files and secrets from source control.  
* Use rate limiting on authentication, OTP and sensitive endpoints.  
* Apply server-side validation even when the frontend already validates input.

# **23\. End-to-End System Workflows**

## **23.1 New Student Registration**

37. Student opens GPREC/GNBVG authentication portal.  
38. Student enters required registration details.  
39. System validates @gprec.ac.in email.  
40. System checks Registration Number \+ Email against official Hosteller Master Registry.  
41. Non-match is blocked and logged as an intrusion attempt.  
42. Match proceeds to dual-channel OTP.  
43. OTP success activates account.  
44. Student can log in and use the Resident View.

## **23.2 Daily Attendance**

45. Student receives attendance-window reminder.  
46. Student opens Attendance.  
47. System obtains fresh GPS location.  
48. Server checks hostel geofence and GPS quality/freshness.  
49. Student completes face capture and liveness.  
50. Face service performs matching.  
51. Server checks duplicate attendance.  
52. Transaction creates PRESENT attendance only if mandatory checks pass.  
53. Dashboard updates block/room/overall status.

## **23.3 Student Leaves Hostel**

54. Student requests Day Pass or Night Out Pass.  
55. Student supplies destination, reason and expected return time.  
56. Parent confirmation status is recorded where required by institutional policy.  
57. Warden approves or rejects.  
58. Approved QR pass becomes active.  
59. Departure is recorded as Checked Out.  
60. Return is recorded as Returned.  
61. If expected return time is exceeded, the system creates an overdue alert.

## **23.4 SOS Response**

62. Student activates SOS.  
63. System confirms/auto-triggers the alert.  
64. Warden dashboard receives a high-priority visual/audible alert.  
65. Authorized responder sees student, block, room and permitted contact/location details.  
66. Responder handles the incident and marks Responded.  
67. Response time and action are retained in the audit record.

## **23.5 Unauthorized Registration Attempt**

68. Unknown person enters registration details.  
69. System rejects non-GPREC email or registry mismatch.  
70. System creates UnauthorizedAccessAttempt.  
71. Warden/Admin sees a red intrusion feed entry.  
72. Authorized administrator acknowledges, flags or adds the record to whitelist when legitimately required.

# **24\. Prototype Demo Data and localStorage Requirements**

* Prototype should be pre-populated with realistic synthetic GPREC/GNBVG data.  
* Include students across Blocks A, B and C.  
* Include sample rooms and resident allocations.  
* Include sample attendance records and verification outcomes.  
* Include sample gate passes with different lifecycle states.  
* Include sample safety tickets.  
* Include at least one sample blocked intrusion attempt.  
* Persist prototype state in localStorage for UI demonstration where backend persistence is not yet connected.  
* Real student personal/biometric information must not be used as demo data.

# **25\. Frontend Component Structure**

| Component | Responsibility |
| :---- | :---- |
| AuthPortal | Login, registration entry, GPREC email validation and mode switching |
| RegistrationForm | Student registration and conditional parent/guardian validation |
| OTPModal | 6-digit OTP verification, expiry and resend cooldown |
| SOSButton | Sticky emergency trigger and confirmation |
| AttendanceVerification | Attendance window, GPS, face/liveness flow and result |
| GatePassManager | Day/Night pass creation, QR and lifecycle |
| IncidentReporter | Safety/maintenance ticket creation and tracking |
| WardenDashboard | KPI cards, attendance, passes, SOS and resident monitoring |
| IntrusionMonitor | Unauthorized registration feed and administrative actions |
| EmergencyContacts | One-tap emergency calling directory |
| ResidentDirectory | Block/year/branch/room filtering |
| HostellerRegistryManager | Whitelist creation, editing and bulk CSV import |

# **26\. Updated Implementation Status and Development Priority**

| Area | Current / Previous Status | Updated Next Priority |
| :---- | :---- | :---- |
| Express backend | Working on port 4000 | Retain and extend APIs |
| PostgreSQL \+ Prisma | Connected; initial migration completed | Confirm expanded schema/migrations |
| Student registration | Tested with fictional student | Add institutional gatekeeper and registry |
| Attendance schema | Not confirmed complete in original report | Confirm/migrate Attendance and Attempt models |
| Geofence | Not implemented in original report | Implement server-side GNBVG boundary validation |
| Face/liveness | Not implemented in original report | Implement/evaluate face and liveness service |
| Flutter app | Not started in original report | Build attendance-first student app |
| Warden portal | Not started in original report | Build attendance \+ safety dashboard |
| Authentication | Not confirmed in original report | Implement GPREC email, registry check, OTP, RBAC |
| SOS | New requirement | Implement high-priority alert workflow |
| Gate pass | New requirement | Implement QR lifecycle and approval queue |
| Safety tickets | New requirement | Implement anonymous reporting and status tracker |
| Intrusion monitoring | New requirement | Implement blocked-attempt feed and audit |
| Production security | Incomplete in original report | TLS, Argon2id, RBAC, rate limiting, audit and secret management |

## **26.1 Recommended Build Order**

73. Confirm PostgreSQL/Prisma Attendance schema and migration.  
74. Implement GNBVG hostel/block/room master data.  
75. Implement Hosteller Master Registry and annual import/rollover.  
76. Implement GPREC email enforcement and registration gatekeeper.  
77. Implement OTP and password recovery.  
78. Implement attendance attempt API and duplicate prevention.  
79. Implement GNBVG geofence and GPS accuracy/freshness checks.  
80. Implement face enrollment, face verification and liveness evaluation.  
81. Connect the Flutter attendance-first student flow.  
82. Build Warden attendance dashboard and block/room filters.  
83. Add 15-minute configurable attendance reminders.  
84. Implement SOS and emergency directory.  
85. Implement gate passes and movement tracking.  
86. Implement safety/maintenance reporting.  
87. Implement intrusion monitoring, audit and reports.  
88. Run security, privacy, reliability and load testing before production.

# **27\. Requirements Traceability Checklist**

| Requirement | Document Status |
| :---- | :---- |
| GPREC organization identity | Included |
| GNBVG full hostel name | Included |
| Block A – Arundhathi | Included |
| Block B – Annapurna | Included |
| Block C – Anuradha | Included |
| GPREC official email restriction @gprec.ac.in | Included |
| Hosteller Master Registry | Included |
| Registration Number \+ Email cross-check | Included |
| Non-hosteller registration blocking | Included |
| Unauthorized Access Attempts feed | Included |
| Name/Reg No/Email/Phone/Timestamp logging | Included |
| 6-digit OTP | Included |
| 5-minute OTP expiry | Included |
| 60-second resend cooldown | Included |
| Dual email/SMS OTP | Included |
| Forgot password flow | Included |
| Strong password policy | Included |
| 2 whitelisted demo students | Included |
| 1 non-hosteller demo ID | Included |
| Exact student registration fields | Included |
| Parent/Guardian conditional validation | Included |
| Block and room allocation | Included |
| Sticky SOS button | Included |
| 3-second SOS countdown/immediate send | Included |
| SOS warden alert feed | Included |
| Day Pass / Night Out Pass | Included |
| QR gate pass | Included |
| Pass lifecycle | Included |
| Anonymous safety reporting | Included |
| Safety ticket lifecycle | Included |
| Safety noticeboard | Included |
| Emergency directory | Included |
| Warden intrusion alert banner | Included |
| Hosteller bulk CSV import | Included |
| Real-time KPI cards | Included |
| Live SOS response feed | Included |
| Gate pass approval queue | Included |
| Visitor log | Included |
| Resident directory filters | Included |
| TLS 1.3 | Included |
| Argon2id | Included |
| AES-256-GCM | Included |
| HMAC-SHA-256 | Included |
| SHA-256 | Included |
| ECDSA P-256 | Included |
| CSPRNG | Included |
| TOTP MFA option | Included |
| RBAC | Included |
| Attendance as primary mechanism | Included |
| Face recognition | Included |
| Liveness verification | Included |
| GPS geofencing | Included |
| GPS accuracy/freshness | Included |
| Duplicate attendance prevention | Included |
| Configurable attendance window | Included |
| 15-minute attendance reminder | Included |
| Block-wise attendance dashboard | Included |
| Room-wise attendance | Included |
| Attendance states | Included |
| Attendance audit trail | Included |
| Current verified implementation status preserved | Included |

# **28\. Final Project Specification Note**

This updated report combines the original technical project report with the new GPREC/GNBVG deployment requirements. The original report explicitly distinguishes verified implementation from proposed design; that distinction is retained. The existing verified progress includes the Express backend, PostgreSQL connection, initial Prisma migration and tested student registration/listing, while attendance, geofencing, face/liveness, Flutter and warden interfaces were previously identified as not yet verified/implemented. fileciteturn0file0L323-L338

The most important implementation path is therefore attendance-first: complete the Attendance schema, enforce GNBVG geofencing server-side, integrate face recognition and liveness, prevent duplicate attendance, and expose live attendance status to the warden dashboard before expanding the system with the full safety and movement modules.

[image1]: <data:image/png;base64,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>