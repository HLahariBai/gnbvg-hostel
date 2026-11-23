# Implementation Plan: GNBVG Hostel Safety, Attendance & Movement System

## Monorepo & Directory Structure Architecture
```
GNBVG/
├── SPEC.md                           # System technical specification
├── PLAN.md                           # Phased execution plan
├── package.json                      # Workspace root configuration
├── tsconfig.json                     # Shared root TypeScript configuration
├── .gitignore                        # Global ignore rules
├── server/                           # Express + TypeScript Backend
│   ├── .env.example                  # Exhaustive environment variable template
│   ├── package.json                  # Backend dependencies and scripts
│   ├── tsconfig.json                 # Backend TypeScript configuration
│   ├── prisma/
│   │   ├── schema.prisma             # Complete normalized PostgreSQL schema
│   │   └── migrations/               # Initial migration SQL
│   └── src/
│       ├── config/
│       │   ├── env.ts                # Strict startup environment validator
│       │   └── database.ts           # Prisma client singleton & query logger
│       ├── constants/                # System enums, error codes, defaults
│       ├── middleware/               # Auth, RBAC, rate-limiting, error handler
│       ├── modules/                  # Feature modules
│       ├── utils/                    # Security, cryptographic, and crypto utils
│       └── server.ts                 # Server entrypoint
└── client/                           # React + Vite + Tailwind Frontend
    ├── package.json                  # Frontend dependencies
    ├── tsconfig.json                 # Frontend TypeScript configuration
    ├── tsconfig.node.json            # Vite node TypeScript configuration
    ├── vite.config.ts                # Vite build configuration
    ├── tailwind.config.js            # Design system (Navy/Slate/Emerald/Crimson)
    ├── postcss.config.js             # PostCSS plugins
    └── src/                          # Frontend source structure
```

---

## Phase Breakdown

### Phase 1: Core Infrastructure & Database Schema (CURRENT FOCUS)
- Scaffold workspace root, `server/`, and `client/` directories with full TypeScript and linting configs.
- Provide comprehensive `.env.example` defining database URLs, Redis URLs, JWT secrets, AES-256-GCM encryption keys, HMAC secrets, and SMTP/TOTP configurations.
- Implement strict startup environment validator (`server/src/config/env.ts`) that crashes immediately upon boot if any critical secret or configuration is absent or malformed.
- Write the complete normalized Prisma database schema (`server/prisma/schema.prisma`) matching every entity, relation, unique constraint, index, and immutable audit log in `SPEC.md`.
- Generate migration and configure database connection client with parameterized query safety.
- Verify clean compilation across client and server.

### Phase 2: Institutional Authentication, Gatekeeper & Intrusion Monitoring
- Official `@gprec.ac.in` domain restriction middleware and validators.
- Registration gatekeeper checking `Registration Number + Email` against `HostellerRegistry`.
- Dual-channel 6-digit OTP generator with 5-minute expiry, 60s cooldown, and rate-limiting.
- Argon2id password hashing and forgot-password recovery flow.
- Non-hosteller intrusion attempt logging to `UnauthorizedAccessAttempt` and real-time feed APIs.

### Phase 3: Primary Attendance Engine & Server-Side Geofencing
- Authoritative attendance attempt orchestration: Window check, Geofence containment, GPS accuracy & freshness.
- Python/FastAPI face recognition and presentation-attack liveness verification integration.
- Server-side timezone-aware attendance date derivation and transactional duplicate prevention.
- Attendance states: `PRESENT`, `PENDING_REVIEW`, `REJECTED`, `DUPLICATE`, `NOT_GIVEN`.
- Block-wise and Room-wise attendance roll-ups.

### Phase 4: Resident Safety, Sticky SOS & Digital Movement
- Sticky SOS emergency panic button with 3-second auto-trigger countdown and instant broadcast.
- Digital QR Gate Pass lifecycle (`DAY_PASS`, `NIGHT_OUT_PASS`: `Pending` -> `Approved` -> `Checked Out` -> `Returned`).
- Overdue return alerts and warden escalation.
- Anonymous and identified safety/maintenance incident reporting (`SafetyTicket`).
- External visitor logging with identity proof tracking.
- Emergency contacts directory and broadcast safety noticeboard.

### Phase 5: Warden & Admin Live Dashboard
- Real-time KPI summary cards (Present, On Leave, Out on Pass, Overdue, Active SOS, Blocked Intrusions).
- Live Block A (Arundhathi), Block B (Annapurna), Block C (Anuradha), and room matrix filtering.
- High-priority audible and visual SOS response feed with resolution audit.
- Gate pass approval queue and visitor entry/exit recorder.
- Hosteller Master List manager: Bulk CSV import, student deactivation, annual rollover.

### Phase 6: Production Hardening, Audit Trails & Deployment
- TLS 1.3 configuration, strict CORS origin filtering, and Helmet security headers.
- Rate limiting on authentication and sensitive endpoints.
- Immutable AuditLog tracking of every sensitive warden and administrative action.
- Database backup encryption and disaster restoration test suite.
