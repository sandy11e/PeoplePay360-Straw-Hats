# PeoplePay360: Comprehensive System Architecture & Technical Manual

> **Enterprise HR & Payroll Management System**  
> *Developed for the Odoo Hackathon 2026*  
> **Repository:** `sandy11e/PeoplePay360-Straw-Hats`  
> **Version:** 1.0.0-PROD  
> **Audit Status:** ✅ Complete End-to-End Verification (64/64 Backend Tests Passed | 28/28 Frontend Tests Passed)

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [High-Level Architecture & Monorepo Layout](#2-high-level-architecture--monorepo-layout)
3. [Technology Stack & Runtime Dependencies](#3-technology-stack--runtime-dependencies)
4. [End-to-End Domain Lifecycle & Business Workflows](#4-end-to-end-domain-lifecycle--business-workflows)
5. [Security, Authentication & Token Family Architecture](#5-security-authentication--token-family-architecture)
6. [Role-Based Access Control (RBAC) Matrix](#6-role-based-access-control-rbac-matrix)
7. [In-Depth Module-by-Module Breakdown](#7-in-depth-module-by-module-breakdown)
   - 7.1. [Authentication & Session Engine](#71-authentication--session-engine)
   - 7.2. [User Management & Security Administration](#72-user-management--security-administration)
   - 7.3. [Departments & Organizational Hierarchy](#73-departments--organizational-hierarchy)
   - 7.4. [Job Positions & Classifications](#74-job-positions--classifications)
   - 7.5. [Employee Management & 360° Profiles](#75-employee-management--360-profiles)
   - 7.6. [Bulk Excel Employee Import Engine](#76-bulk-excel-employee-import-engine)
   - 7.7. [Employment Contracts & Compensation Terms](#77-employment-contracts--compensation-terms)
   - 7.8. [Work Schedules & Shift Planning](#78-work-schedules--shift-planning)
   - 7.9. [Attendance Tracking & Digital Punch Clock](#79-attendance-tracking--digital-punch-clock)
   - 7.10. [Leave Policies, Quota Allocations & Approvals](#710-leave-policies-quota-allocations--approvals)
   - 7.11. [Salary Structures & Declarative Rule Engine](#711-salary-structures--declarative-rule-engine)
   - 7.12. [Payroll Processing & Payrun Lifecycle](#712-payroll-processing--payrun-lifecycle)
   - 7.13. [Payslips & Financial Snapshots](#713-payslips--financial-snapshots)
   - 7.14. [Streaming PDF Generation & SMTP Email Delivery](#714-streaming-pdf-generation--smtp-email-delivery)
   - 7.15. [Role-Tailored Executive Dashboards](#715-role-tailored-executive-dashboards)
   - 7.16. [Append-Only Audit Trails & Compliance](#716-append-only-audit-trails--compliance)
8. [The Deterministic Calculation Engine (Deep Dive)](#8-the-deterministic-calculation-engine-deep-dive)
9. [Complete Database Entity-Relationship Schema & Prisma Models](#9-complete-database-entity-relationship-schema--prisma-models)
10. [Complete REST API Specification (83 Endpoints)](#10-complete-rest-api-specification-83-endpoints)
11. [Frontend Architecture, UI Design System & Aesthetics](#11-frontend-architecture-ui-design-system--aesthetics)
12. [Setup, Installation & Local Development Guide](#12-setup-installation--local-development-guide)
13. [Automated Testing & Quality Verification](#13-automated-testing--quality-verification)
14. [Default Seed Data & Demo Credentials](#14-default-seed-data--demo-credentials)
15. [Troubleshooting & Frequently Asked Questions](#15-troubleshooting--frequently-asked-questions)

---

## 1. Executive Summary & Core Philosophy

**PeoplePay360** is a modern, enterprise-grade Human Resources and Payroll Management System engineered from the ground up for the Odoo Hackathon 2026. It replaces legacy, fragmented spreadsheets and brittle HR tools with a unified, auditable, and secure web platform.

### Core Architectural Principles:

1. **Zero-Variance Monetary Math**: All monetary calculations utilize arbitrary-precision decimal mathematics (`Prisma.Decimal` backed by PostgreSQL's `DECIMAL(12,2)` / `DECIMAL(14,2)`). Standard IEEE-754 floating-point arithmetic is strictly prohibited in financial paths, eliminating rounding drifts.
2. **Immutable Payroll Snapshots**: When a payrun cycle is validated, employee contracts, salary structures, applied rules, calculation breakdowns, and payslip line items are permanently snapshot into the database. Subsequent modifications to an employee's contract or base salary can **never** alter past historical payruns.
3. **Strict Least-Privilege Role Isolation**: Every route, API endpoint, query, and UI component respects an authoritative 5-tier role hierarchy (`ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER`, `EMPLOYEE`). Pure employees are physically barred from administrative views, and HR managers cannot inspect financial figures or company gross disbursements.
4. **Token Family Theft Protection**: Authentication uses short-lived in-memory JSON Web Tokens (15-minute TTL) coupled with rotating, cryptographically hashed refresh tokens stored in `HttpOnly`, `SameSite=Lax` cookies. If a refresh token reuse is detected, the entire token family is immediately revoked, nullifying session hijacking attempts.
5. **Fluid, Human-Centric Aesthetic Experience**: The user interface pairs an Oceanic Navy (`#082366`) and Soft Periwinkle (`#c7d4fc`) color palette with animated SVG wave canvas physics, micro-interactions, responsive drawers, and accessible components built on modern Base UI primitives.

---

## 2. High-Level Architecture & Monorepo Layout

PeoplePay360 is organized as an **npm workspaces monorepo**, ensuring strict TypeScript contract sharing between the backend API and frontend React client while keeping concerns cleanly isolated.

```
peoplepay360/
├── apps/
│   ├── api/                          # Node.js 22 + Express 5 REST API
│   │   ├── prisma/
│   │   │   ├── migrations/           # 12 sequential PostgreSQL Prisma migrations
│   │   │   └── schema.prisma         # Authoritative database entity definitions
│   │   └── src/
│   │       ├── auth/                 # Authentication routes, middleware & JWT tokens
│   │       ├── config/               # Zod-validated environment variables
│   │       ├── lib/                  # Prisma client singleton & DB connection pooling
│   │       ├── middleware/           # Error handling, rate limiting, helmet, logging
│   │       ├── modules/              # 13 domain feature modules
│   │       │   ├── attendance/       # Daily check-in/out & worked minutes computation
│   │       │   ├── audit/            # Append-only audit logging & sanitization
│   │       │   ├── contracts/        # Employment contracts & wage definitions
│   │       │   ├── dashboard/        # SQL aggregate pipelines for HR, Payroll, Me
│   │       │   ├── departments/      # Department units & hierarchy
│   │       │   ├── employees/        # Employee profiles & bulk Excel import
│   │       │   ├── job-positions/    # Positions & classifications
│   │       │   ├── leave/            # Leave types, quotas, requests & approvals
│   │       │   ├── payroll/          # Deterministic calculation engine & payruns
│   │       │   ├── payslips/         # Line item snapshots, streaming PDF, deliveries
│   │       │   ├── salary-structures/# Salary structures & declarative rule sequencing
│   │       │   ├── users/            # System user accounts & status toggling
│   │       │   └── work-schedules/   # Weekly templates, shifts & employee assignments
│   │       ├── routes/               # Health check and role boundary probes
│   │       ├── scripts/              # Seed scripts, DB verifications, test runners
│   │       ├── services/             # Nodemailer SMTP and PDFKit integration
│   │       ├── tests/                # Supertest integration test suites (64 tests)
│   │       ├── app.ts                # Express application definition & middleware
│   │       └── server.ts             # HTTP server bootstrap & graceful shutdown
│   │
│   └── web/                          # React 19 + Vite 8 SPA
│       └── src/
│           ├── api/                  # Typed Fetch wrapper with transparent 401 retry
│           ├── assets/               # Logos, vector icons & static media
│           ├── auth/                 # React AuthContext, Token State & Route Guards
│           ├── components/
│           │   ├── common/           # WaveBackground, StatCard, Badge, Dialogs
│           │   ├── layout/           # AppLayout, Sidebar, Topbar, MobileDrawer
│           │   └── ui/               # Base UI accessible primitives (Buttons, Inputs, etc.)
│           ├── pages/                # 20+ feature pages & views
│           │   ├── attendance/       # Attendance logs & Punch Clock
│           │   ├── audit/            # System audit stream inspector
│           │   ├── contracts/        # Contract lifecycle registry
│           │   ├── dashboard-page.tsx# Executive Command Center (Role-aware tabs)
│           │   ├── departments/      # Department management
│           │   ├── employees/        # Directory, 360° Profile, Bulk Excel Import
│           │   ├── job-positions/    # Positions directory
│           │   ├── leave/            # Leave queue, types & allocation dialogs
│           │   ├── login-page.tsx    # Password toggle & animated oceanic canvas
│           │   ├── payruns/          # Payrun list & period calculation details
│           │   ├── payslips/         # Payslip registry, statement details & my-payslips
│           │   ├── salary/           # Salary structures & visual rule builder
│           │   ├── schedules/        # Weekly visual schedule planner
│           │   ├── self-service/     # Personal employee portal & attendance
│           │   └── users/            # System account administrator
│           ├── types/                # Frontend TypeScript data transfer interfaces
│           ├── utils/                # Date, currency, minute formatters & RBAC helpers
│           ├── App.tsx               # Client route registration & provider wiring
│           ├── index.css             # Tailwind v4 theme tokens & CSS keyframes
│           └── main.tsx              # DOM mounting point
│
├── packages/
│   └── shared/                       # Cross-workspace TypeScript interfaces & contracts
│
├── docs/                             # Architectural records & engineering verification logs
│   ├── 00-project-overview.md        # Initial project specification
│   ├── PEOPLEPAY360_MASTER_MANUAL.md # (This File) Authoritative manual
│   └── versions/                     # Historical implementation milestones (V13 to V24)
│
├── package.json                      # Root workspace configuration
└── README.md                         # Quickstart reference for repository root
```

---

## 3. Technology Stack & Runtime Dependencies

### Backend API (`apps/api`)
- **Runtime Environment:** Node.js `>=22 <23` (running native ESM modules)
- **Web Framework:** Express `5.2.1` (next-generation HTTP engine with native async error propagation)
- **Language:** TypeScript `7.0.2` (strict mode enabled with `noImplicitAny` and `exactOptionalPropertyTypes`)
- **Database Engine:** PostgreSQL 15+
- **Object-Relational Mapping (ORM):** Prisma ORM `7.10.0` with `@prisma/adapter-pg` connection pool
- **Schema Validation & Parsing:** Zod `4.5.4`
- **Security & Cryptography:** 
  - `jose` `6.2.12` (JWT signing and verification via HMAC-SHA256)
  - `bcryptjs` `3.0.3` (password hashing with work factor 10)
  - `helmet` `8.3.0` (HTTP security headers, CSP, X-Frame-Options)
  - `cookie-parser` `1.4.7` (signed, HttpOnly cookie extraction)
- **PDF Generation Engine:** `pdfkit` `0.20.2` (direct streaming of dynamic vector PDFs)
- **Email Delivery Service:** `nodemailer` `10.0.0` (RFC 5322 MIME compilation with real SMTP or in-memory transport)
- **Spreadsheet Processing:** `xlsx` (SheetJS) `0.18.5` (server-side workbook validation)
- **Testing Framework:** Native Node.js test runner (`node:test`) + `supertest` `7.2.2` + `tsx` `4.23.13`

### Frontend Client (`apps/web`)
- **UI Library:** React `19.0.0` (concurrent rendering, server component ready)
- **Build Tooling & Bundler:** Vite `8.0.0`
- **Language:** TypeScript `5.8.0`
- **Styling Architecture:** Tailwind CSS `v4.0.0` with modern `@theme inline` OKLCH color tokenization
- **Component Primitives:** `@base-ui/react` (accessible, headless component system conforming strictly to standard React composition without forbidden `asChild` wrappers)
- **Icons:** `lucide-react` `0.475.0`
- **Client Routing:** `react-router-dom` `7.2.0`
- **Client Spreadsheet Parsing:** `xlsx` (SheetJS) `0.18.5` (instant browser-side previews of Excel/CSV uploads)
- **Typography:** `@fontsource-variable/geist`
- **Testing Engine:** Vitest `3.0.0`

---

## 4. End-to-End Domain Lifecycle & Business Workflows

PeoplePay360 models real-world corporate operations across a seamless, unidirectional lifecycle:

```mermaid
flowchart TD
    A[1. Org Structure: Depts & Job Positions] --> B[2. Employee Enrollment: Single or Bulk Excel]
    B --> C[3. Employment Contract: Base Salary & Dates]
    B --> D[4. Work Schedule: Shifts & Weekly Hours]
    B --> E[5. Leave Quotas: Annual Paid Allotment]
    C & D & E --> F[6. Daily Operations: Attendance & Leaves]
    C --> G[7. Compensation Design: Salary Structures & Rules]
    F & G --> H[8. Payrun Cycle: Draft Period Creation]
    H --> I[9. Calculation: Deterministic Pure Math Engine]
    I --> J[10. Payrun Validation: Immutability Snapshot]
    J --> K[11. Payslip Generation: Line Item Records]
    K --> L[12. PDF Streaming & SMTP Email Delivery]
    K --> M[13. Payment Disbursement: Settlement Tracking]
    L & M --> N[14. Role Dashboards & Audit Trail]
```

### Chronological Business Stages:

1. **Organizational Foundation**: Administrators and HR Managers define Departments (e.g., Engineering, HR, Finance) and Job Positions (e.g., Software Engineer, Payroll Specialist).
2. **Employee Onboarding**:
   - Single enrollment via modal form with field validation.
   - Bulk enrollment via Excel (`.xlsx`, `.xls`, `.csv`) spreadsheet upload with instant in-browser parsing, column auto-mapping, and one-click automatic generation of Contracts, Work Schedules, and Leave Allocations.
3. **Contract Formalization**: Contracts bind an employee to an effective date range, currency (`USD`, `INR`, etc.), and base monthly/annual wage rate. Status moves from `DRAFT` to `ACTIVE`.
4. **Shift & Schedule Assignment**: Employees are mapped to weekly Work Schedules defining working days (Monday–Friday) with start/end times and break deductions.
5. **Time & Attendance Tracking**:
   - Employees record daily punches via the Web Punch Clock.
   - HR Managers can log manual shifts or inspect logs. Worked minutes are strictly calculated on the server to prevent client clock tampering.
6. **Time-Off & Leave Management**:
   - Employees view real-time quota balances and submit leave requests.
   - HR Managers review pending leaves with full approval/rejection workflows and audit comments. Approved leaves deduct quota balances automatically.
7. **Salary Structure & Rule Configuration**: Payroll Managers define salary rule templates. Rules are classified as `EARNING` or `DEDUCTION`, calculated as `FIXED` amounts or `PERCENTAGE` of `BASE_SALARY` or `GROSS_EARNINGS`, and evaluated in strict sequence order.
8. **Payrun Initiation & Calculation**:
   - A payroll cycle is created with period start and end dates (`DRAFT`).
   - The calculation engine is triggered. It gathers all active contracts and salary structures, executes deterministic decimal formulas, identifies potential warnings (e.g., missing contract or unassigned structure), and computes Gross, Deductions, and Net Pay.
9. **Validation & Immutability Freeze**:
   - An authorized Payroll Manager or Admin reviews calculation aggregates and clicks **Validate**.
   - The payrun transitions to `VALIDATED`. This creates permanent, immutable `Payslip` and `PayslipLine` records. No further edits can occur.
10. **Delivery & Disbursement**:
    - Payslip PDFs are generated dynamically on demand using PDFKit.
    - Payslips can be emailed individually or in bulk to employees' work email addresses using real SMTP or simulated test transports.
    - Financial settlement transitions from `UNPAID` → `PROCESSING` → `PAID`.
11. **Executive Insight & Compliance**:
    - Aggregated metrics populate real-time dashboards tailored to each user's specific role.
    - Every significant action writes an immutable record to the `audit_logs` table.

---

## 5. Security, Authentication & Token Family Architecture

PeoplePay360 adheres to enterprise security standards to mitigate XSS, CSRF, session fixation, and token replay attacks.

```
+-------------------------------------------------------------------------+
|                           CLIENT (React SPA)                            |
|                                                                         |
|  - Short-Lived Access JWT kept in REACT IN-MEMORY STATE ONLY            |
|  - NEVER stored in localStorage, sessionStorage, or IndexedDB           |
|  - Transmitted via: Authorization: Bearer <access_jwt>                  |
+------------------------------------+------------------------------------+
                                     |
                       (API Request) | (401 Expired Response)
                                     v
+------------------------------------+------------------------------------+
|                         SERVER (Express API)                            |
|                                                                         |
|  - Verifies JWT HMAC-SHA256 signature and 15-minute expiration          |
|  - When expired: Client transparently calls POST /api/v1/auth/refresh   |
|  - Client browser sends Refresh Token via HttpOnly, SameSite=Lax Cookie |
+------------------------------------+------------------------------------+
                                     |
                      (Database Session Verification)
                                     v
+------------------------------------+------------------------------------+
|                       POSTGRESQL DATABASE                               |
|                                                                         |
|  - Matches SHA-256 hash of refresh token                                |
|  - Verifies User.isActive == true                                       |
|  - IF REUSED TOKEN DETECTED: Revokes entire familyId (THEFT DEFENSE)    |
|  - IF VALID: Rotates token, issues new tokenHash, updates DB, sets      |
|    new HttpOnly cookie, and returns fresh 15-min Access JWT in JSON     |
+-------------------------------------------------------------------------+
```

### Security Measures:

1. **Dual-Token Lifetime**:
   - **Access Token:** 15-minute validity, signed with `JWT_SECRET`, stored solely in React state memory (`auth-context.tsx`). Even if a cross-site scripting flaw were present, access tokens cannot be harvested from local storage.
   - **Refresh Token:** 7-day validity, cryptographically random 64-character token, stored in the browser as a secure, signed `HttpOnly`, `SameSite=Lax` cookie.
2. **Refresh Token Rotation & Family Reuse Detection**:
   - Every refresh request generates a brand new refresh token and revokes the predecessor.
   - Each token belongs to a `familyId` UUID. If an adversary attempts to replay an already-revoked refresh token, the system detects a token reuse attack and **immediately invalidates all active tokens in that entire family**, instantly terminating the compromised session.
3. **Real-Time Deactivation Check**:
   - Whenever an administrator deactivates a user (`isActive: false`), all token refresh operations and protected API calls fail immediately, eliminating stale access windows.
4. **Password Cryptography & Interface Polish**:
   - Passwords are salted and hashed using `bcryptjs` with a work factor of 10.
   - The login interface features an interactive `Eye` / `EyeOff` password visibility toggle, allowing users to verify their password before submission while preserving browser password manager autofill support.
5. **Sanitized Audit Serialization**:
   - The audit log engine scrubs all sensitive keys (`password`, `passwordHash`, `token`, `secret`, `authorization`) before persisting JSON metadata payloads to prevent credential leaks.

---

## 6. Role-Based Access Control (RBAC) Matrix

The system enforces least privilege across **5 distinct roles**. Permissions are checked at both the Express API route level (`requireRole`) and the React Router layer (`ProtectedRoute` and `sidebar.tsx`).

| Functional Domain / Subsystem | Endpoint Group | ADMIN | HR_MANAGER | PAYROLL_MANAGER | PAYROLL_USER | EMPLOYEE |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **System Health & Public Auth** | `/api/v1/health`, `/auth/*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **User Account Administration** | `/api/v1/users/*` | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| **Employee Directory & Profiles** | `/api/v1/employees/*` | ✅ Full | ✅ Full | 👁️ Read-only | 👁️ Read-only | ❌ |
| **Bulk Excel Employee Import** | `POST /api/v1/employees/bulk-import` | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| **Departments & Job Positions** | `/api/v1/departments`, `/job-positions` | ✅ Full | ✅ Full | 👁️ Read-only | 👁️ Read-only | ❌ |
| **Employment Contracts** | `/api/v1/contracts/*` | ✅ Full | ✅ Full | ✅ Full | 👁️ Read-only | ❌ |
| **Work Schedules & Assignments** | `/api/v1/work-schedules/*` | ✅ Full | ✅ Full | 👁️ Read-only | 👁️ Read-only | ❌ |
| **Attendance Operations (All Staff)**| `/api/v1/attendance` | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| **Self-Service Attendance Punch** | `/api/v1/attendance/check-in`, `/out` | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| **Leave Management & Approvals** | `/api/v1/leave-requests/:id/review` | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| **Self-Service Leave Applications** | `/api/v1/leave-requests/me`, `/me` | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| **Salary Structures & Rule Builder** | `/api/v1/salary-structures/*` | ✅ Full | ❌ | ✅ Full | 👁️ Read-only | ❌ |
| **Payrun Initiation & Calculation** | `/api/v1/payruns`, `/:id/calculate`| ✅ Full | ❌ | ✅ Full | 👁️ Read-only | ❌ |
| **Payrun Validation (Freeze)** | `POST /api/v1/payruns/:id/validate` | ✅ Full | ❌ | ✅ Full | ❌ | ❌ |
| **Payslips & Payment Status** | `/api/v1/payslips/*` | ✅ Full | ❌ | ✅ Full | 👁️ Read-only | ❌ |
| **Self-Service Payslip Statements** | `GET /api/v1/payslips/me` | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| **PDF Payslip Streaming** | `GET /api/v1/payslips/:id/pdf` | ✅ All | ❌ | ✅ All | ✅ All | ✅ Own Only |
| **Payslip Email Dispatch** | `POST /api/v1/payslips/:id/email` | ✅ Full | ❌ | ✅ Full | ❌ | ❌ |
| **HR Command Center** | `GET /api/v1/dashboard/hr` | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| **Payroll Command Center** | `GET /api/v1/dashboard/payroll` | ✅ Full | ❌ | ✅ Full | ✅ Full | ❌ |
| **Employee Portal Dashboard** | `GET /api/v1/dashboard/me` | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| **System Audit Logs & Inspector** | `GET /api/v1/audit-logs` | ✅ Full | ❌ | ❌ | ❌ | ❌ |

---

## 7. In-Depth Module-by-Module Breakdown

### 7.1. Authentication & Session Engine
- **Business Purpose:** Verifies user identity, issues cryptographic tokens, coordinates session refreshes, and prevents credential harvesting.
- **Backend Components:**
  - Route: `apps/api/src/auth/auth.route.ts`
  - Middleware: `apps/api/src/auth/auth.middleware.ts`
  - Token Utilities: `apps/api/src/auth/auth.tokens.ts`
- **Key Functionality:**
  - `POST /api/v1/auth/login`: Authenticates email and password. Generates an in-memory access token (15-minute expiry) and a cryptographically hashed refresh token stored in an `HttpOnly`, `SameSite=Lax` cookie.
  - `POST /api/v1/auth/refresh`: Transparently rotates refresh tokens. Verifies that the associated user account is active.
  - `POST /api/v1/auth/logout`: Revokes the refresh token hash in the database, clears cookies, and resets client memory.
  - `GET /api/v1/auth/me`: Returns the authenticated user's profile, role, and linked employee ID.
- **Frontend Views:**
  - `apps/web/src/pages/login-page.tsx`: Features an interactive password visibility toggle, animated oceanic wave background, validation error handling, and demo account credential buttons.

---

### 7.2. User Management & Security Administration
- **Business Purpose:** Empowers System Administrators to oversee all user accounts, assign roles, deactivate credentials, and perform administrative password resets.
- **Access Rule:** Restricted strictly to the `ADMIN` role.
- **Backend Components:**
  - Route: `apps/api/src/modules/users/user.route.ts`
  - Schema: `apps/api/src/modules/users/user.schema.ts`
- **Key Functionality:**
  - Prevent Self-Escalation / Self-Deactivation: Administrators cannot alter their own role or deactivate their own account, preventing accidental lockouts.
  - Role Switching: Instantly updates user privileges across the platform.
  - Password Reset: Updates the user's password hash and automatically revokes all existing refresh tokens, forcing re-authentication across all devices.
- **Frontend Views:**
  - `apps/web/src/pages/users/users-page.tsx`: Includes search filtering, role modification dialogs, status toggle switches, and password reset modals.

---

### 7.3. Departments & Organizational Hierarchy
- **Business Purpose:** Groups employees into organizational business units for reporting, approval hierarchies, and budget management.
- **Backend Components:**
  - Route: `apps/api/src/modules/departments/department.route.ts`
  - Schema: `apps/api/src/modules/departments/department.schema.ts`
- **Key Functionality:**
  - Enforces unique department codes (e.g., `ENG`, `HR`, `FIN`) and names.
  - Restricts deletion if employees are actively assigned to the department (`onDelete: Restrict`).
- **Frontend Views:**
  - `apps/web/src/pages/departments/departments-page.tsx`: Displays department cards with active employee headcounts and create/edit modal drawers.

---

### 7.4. Job Positions & Classifications
- **Business Purpose:** Defines official corporate titles, roles, and job descriptions within the organization.
- **Backend Components:**
  - Route: `apps/api/src/modules/job-positions/job-position.route.ts`
  - Schema: `apps/api/src/modules/job-positions/job-position.schema.ts`
- **Key Functionality:**
  - Enforces unique position codes (e.g., `SWE`, `HR_MGR`, `PAY_SPEC`) and titles.
  - Linked directly to employee profiles and payroll reporting.
- **Frontend Views:**
  - `apps/web/src/pages/job-positions/job-positions-page.tsx`: Includes a filterable table of job titles, associated employee counts, and creation dialogs.

---

### 7.5. Employee Management & 360° Profiles
- **Business Purpose:** Serves as the central repository for employee master records, personal details, contact data, manager hierarchies, and system user account linkages.
- **Backend Components:**
  - Route: `apps/api/src/modules/employees/employee.route.ts`
  - Schema: `apps/api/src/modules/employees/employee.schema.ts`
- **Key Functionality:**
  - Unique Employee Code: Auto-enforced format (e.g., `EMP-001`).
  - Employment Statuses: `ACTIVE`, `ON_LEAVE`, `NOTICE_PERIOD`, `RESIGNED`, `TERMINATED`, `INACTIVE`.
  - User Account Linking: Connects an employee master record to a system `User` account for self-service portal access.
  - Manager Hierarchy: Self-referential relation allowing multi-level management structures.
- **Frontend Views:**
  - `apps/web/src/pages/employees/employees-page.tsx`: Features live text search, department filters, status filters, and enrollment buttons.
  - `apps/web/src/pages/employees/employee-details-page.tsx`: Comprehensive 360° view with 6 operational tabs:
    1. *Overview*: Contact info, department, position, joining date, manager.
    2. *Contracts*: Historical and current compensation contracts.
    3. *Work Schedules*: Active shift templates and historical assignments.
    4. *Attendance History*: Monthly shift logs and worked hour calculations.
    5. *Leave Allocations*: Year-by-year quota balances (Allocated vs. Used).
    6. *Salary Structures*: Active salary structure assignments.

---

### 7.6. Bulk Excel Employee Import Engine
- **Business Purpose:** Enables one-click onboarding of hundreds of employees from an Excel (`.xlsx`, `.xls`) or CSV spreadsheet, automatically provisioning contracts, schedules, and leave balances.
- **Backend Components:**
  - Endpoint: `POST /api/v1/employees/bulk-import`
  - Route Handler: `apps/api/src/modules/employees/employee.route.ts` (lines 381–560)
  - Schema: `bulkImportEmployeesSchema` in `apps/api/src/modules/employees/employee.schema.ts`
- **Key Functionality:**
  - Flexible Entity Matching: Resolves Departments, Job Positions, and Salary Structures by ID, Code, or Name (case-insensitive).
  - Automated Contract Generation: When enabled, automatically generates an active contract using the provided Base Salary and Currency.
  - Default Work Schedule Assignment: Links newly imported employees to the active company schedule (e.g., Standard 40h).
  - Default Leave Quota Allocation: Provisions initial leave balances for the current calendar year.
  - Transactional Safety: Records audit entries and returns detailed success/failure summaries for each row.
- **Frontend Views:**
  - `apps/web/src/pages/employees/bulk-import-dialog.tsx`: Built with SheetJS (`xlsx`). Features drag-and-drop file upload, automated header mapping, real-time data grid preview, validation badge counters, and automated provisioning toggles.

---

### 7.7. Employment Contracts & Compensation Terms
- **Business Purpose:** Manages formal employment contracts, defining wage rates, payment frequencies, currency, and validity periods.
- **Backend Components:**
  - Route: `apps/api/src/modules/contracts/contract.route.ts`
  - Schema: `apps/api/src/modules/contracts/contract.schema.ts`
- **Key Functionality:**
  - Status Lifecycle: `DRAFT` → `ACTIVE` → `EXPIRED` / `TERMINATED` / `CANCELLED`.
  - Single Active Contract Constraint: Validates that an employee has only one active contract for any given date range.
  - Decimal Wage Accuracy: Stores base salaries using exact PostgreSQL `DECIMAL` types.
- **Frontend Views:**
  - `apps/web/src/pages/contracts/contracts-page.tsx`: Status-filtered contract register, new contract modal with dynamic employee search, currency selector, and status transition workflows.

---

### 7.8. Work Schedules & Shift Planning
- **Business Purpose:** Defines standard working hours, daily shifts, and break times across the 7 days of the week, enabling expected hours calculations.
- **Backend Components:**
  - Route: `apps/api/src/modules/work-schedules/work-schedule.route.ts`
  - Schema: `apps/api/src/modules/work-schedules/work-schedule.schema.ts`
- **Key Functionality:**
  - Weekly Day Definitions: Day-by-day toggle (`MONDAY` through `SUNDAY`), start time (HH:mm), end time (HH:mm), and break duration (minutes).
  - Net Expected Minutes: Automatically calculates expected working minutes `(EndTime - StartTime) - BreakMinutes`.
  - Schedule Assignments: Maps employees to schedules with `effectiveFrom` and optional `effectiveTo` dates.
- **Frontend Views:**
  - `apps/web/src/pages/schedules/work-schedules-page.tsx`: Visual weekly schedule grid, day-by-day shift configurator, and employee assignment drawer.

---

### 7.9. Attendance Tracking & Digital Punch Clock
- **Business Purpose:** Records employee shift attendance, check-ins, check-outs, and calculates total worked minutes.
- **Backend Components:**
  - Route: `apps/api/src/modules/attendance/attendance.route.ts`
  - Schema: `apps/api/src/modules/attendance/attendance.schema.ts`
- **Key Functionality:**
  - Authoritative Server Timestamps: Worked minutes are calculated strictly on the backend `(checkOutAt - checkInAt)` to prevent client clock manipulation.
  - Single Open Shift Guard: Prevents double check-ins if a shift is already active.
  - Attendance Sources: `WEB`, `KIOSK`, `MANUAL`.
  - Status Classifications: `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`.
- **Frontend Views:**
  - `apps/web/src/pages/attendance/attendance-page.tsx`: Administrative shift log with date pickers, status filters, and manual shift adjustment dialogs.
  - `apps/web/src/pages/attendance/my-attendance-page.tsx`: Self-service Punch Clock hero card with live duration timers, Check In / Check Out buttons, and personal attendance history.

---

### 7.10. Leave Policies, Quota Allocations & Approvals
- **Business Purpose:** Manages corporate leave categories, annual quota allocations, self-service leave requests, and manager approval workflows.
- **Backend Components:**
  - Route: `apps/api/src/modules/leave/leave.route.ts`
  - Schema: `apps/api/src/modules/leave/leave.schema.ts`
- **Key Functionality:**
  - Leave Types: Custom categories (e.g., Annual, Sick, Maternity) with paid/unpaid flags.
  - Annual Allocations: Unique constraint on `[employeeId, leaveTypeId, year]`. Tracks allocated vs. used days.
  - Balance Enforcement: Verifies that requested days do not exceed remaining quota balances before submission.
  - Approval Workflow: Requests move from `PENDING` → `APPROVED` or `REJECTED`. Approvals automatically update the employee's `usedDays` balance.
  - Cancellation: Employees can cancel their own pending requests.
- **Frontend Views:**
  - `apps/web/src/pages/leave/leave-management-page.tsx`: HR review queue with one-click Approve/Reject dialogs, reviewer comments, leave type manager, and quota allocation modals.
  - `apps/web/src/pages/leave/my-leave-page.tsx`: Self-service view with interactive quota balance progress bars, leave request forms, and historical application tables.

---

### 7.11. Salary Structures & Declarative Rule Engine
- **Business Purpose:** Configures flexible, formulaic compensation policies through sequenced earning and deduction rules without writing custom code or using unsafe `eval()`.
- **Backend Components:**
  - Route: `apps/api/src/modules/salary-structures/salary-structure.route.ts`
  - Schema: `apps/api/src/modules/salary-structures/salary-structure.schema.ts`
- **Key Functionality:**
  - Categories: `EARNING` (adds to gross) or `DEDUCTION` (subtracts from gross).
  - Calculation Types:
    - `FIXED`: Fixed monetary amount.
    - `PERCENTAGE`: Calculated as a percentage of `BASE_SALARY` or running `GROSS_EARNINGS`.
  - Execution Sequence: Ordered sequentially (`1, 2, 3...`), allowing later rules to compute percentages on gross amounts accumulated by earlier earning rules.
- **Frontend Views:**
  - `apps/web/src/pages/salary/salary-structures-page.tsx`: Salary structures catalog and employee assignment manager.
  - `apps/web/src/pages/salary/salary-structure-details-page.tsx`: Drag-and-drop ordered rule builder with rule addition dialogs, base selectors, and taxable status flags.

---

### 7.12. Payroll Processing & Payrun Lifecycle
- **Business Purpose:** Coordinates monthly or bi-weekly payroll runs, executing calculations across all eligible employees, gathering warnings, and preparing financial batches for validation.
- **Backend Components:**
  - Route: `apps/api/src/modules/payroll/payroll.route.ts`
  - Engine Service: `apps/api/src/modules/payroll/payroll-engine.service.ts`
- **Key Functionality:**
  - Lifecycle States: `DRAFT` → `CALCULATED` → `VALIDATED` (or `CANCELLED`).
  - Batch Calculation: Identifies all active employees with active contracts and salary structures within the period.
  - Calculation Audit Warnings: Flags anomalies (e.g., missing contracts, negative net pay) without halting the entire batch.
  - Financial Aggregates: Computes company-wide totals for Gross Pay, Total Deductions, and Net Pay using `Prisma.Decimal`.
- **Frontend Views:**
  - `apps/web/src/pages/payruns/payruns-page.tsx`: Payrun cycle register with status badges, aggregate metrics, and payrun creation modals.
  - `apps/web/src/pages/payruns/payrun-details-page.tsx`: Period summary cards, calculation warning banners, employee breakdown tables, and one-click Validate / Generate Payslips / Bulk Email actions.

---

### 7.13. Payslips & Financial Snapshots
- **Business Purpose:** Manages itemized compensation statements for employees, recording immutable calculation snapshots and tracking payment disbursements.
- **Backend Components:**
  - Route: `apps/api/src/modules/payslips/payslip.route.ts`
  - Service: `apps/api/src/modules/payslips/payslip.service.ts`
- **Key Functionality:**
  - Immutable Payslip Lines: Every earning and deduction rule creates a permanent record in `payslip_lines`.
  - Payment Status Tracking: Tracks disbursement state: `UNPAID` → `PROCESSING` → `PAID` / `FAILED`.
  - Cross-Tenant Security: Pure employees can only query their own payslips (`/payslips/me`). Attempting to access another employee's payslip returns a `403 Forbidden` response.
- **Frontend Views:**
  - `apps/web/src/pages/payslips/payslips-page.tsx`: Finance register with payrun cycle filters, payment status filters, and bulk disbursement actions.
  - `apps/web/src/pages/payslips/payslip-details-page.tsx`: Two-column financial breakdown (Gross Earnings vs. Deductions), line item tables, PDF download button, email dispatch button, and payment status updater modal.
  - `apps/web/src/pages/payslips/my-payslips-page.tsx`: Isolated personal payslip portal for employees.

---

### 7.14. Streaming PDF Generation & SMTP Email Delivery
- **Business Purpose:** Generates dynamic vector PDF payslips on demand and dispatches them directly to employee inboxes via SMTP.
- **Backend Components:**
  - PDF Engine: `apps/api/src/modules/payslips/payslip-pdf.service.ts`
  - Delivery Service: `apps/api/src/modules/payslips/payslip-delivery.service.ts`
  - SMTP Client: `apps/api/src/services/email.service.ts`
- **Key Functionality:**
  - Dynamic PDFKit Streaming: Generates vector PDFs in memory and streams them directly via HTTP `application/pdf` with clean file naming (`payslip_EMP-001_2026-03.pdf`), avoiding temporary files on disk.
  - Dual-Mode Email Transport: Automatically uses real SMTP credentials when configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`), or falls back to an in-memory JSON transport during development and testing.
  - Delivery Auditing: Every email attempt is recorded in the `payslip_deliveries` table with status (`PENDING`, `SENT`, `FAILED`), timestamp, recipient address, and error details if delivery fails.
- **Frontend Views:**
  - Streaming PDF Download: Handled via `triggerBlobDownload` in `apps/web/src/utils/format.ts`.
  - Email Triggers: Includes single payslip delivery modals and bulk payrun email dispatch buttons with live progress feedback.

---

### 7.15. Role-Tailored Executive Dashboards
- **Business Purpose:** Delivers real-time operational insights, key metrics, and quick actions tailored to each user's specific role.
- **Backend Components:**
  - Route: `apps/api/src/modules/dashboard/dashboard.route.ts`
- **Dashboard Variants:**
  1. **HR Management Dashboard (`/dashboard/hr`):**
     - Headcount metrics (Total, Active, On Leave, Resigned).
     - Today's shift attendance breakdown (Present, Late, Absent, Half Day).
     - Pending leave requests queue requiring action.
     - Departmental distribution charts.
  2. **Payroll & Finance Dashboard (`/dashboard/payroll`):**
     - Latest payrun summary and status.
     - Monthly company gross disbursements, deductions, and net payouts.
     - Unpaid payslips counter and pending disbursements.
     - Calculation warnings and anomaly logs.
  3. **Employee Self-Service Portal (`/dashboard/me`):**
     - Punch Clock status and shift duration timer.
     - Annual leave quota balances (Allocated vs. Used vs. Remaining).
     - Latest payslip summary with quick PDF download.
     - Recent leave application statuses.
- **Frontend Views:**
  - `apps/web/src/pages/dashboard-page.tsx`: Unified dashboard that detects the active role and renders the appropriate view. Administrators have access to a tabbed interface allowing them to switch between HR and Payroll command centers.

---

### 7.16. Append-Only Audit Trails & Compliance
- **Business Purpose:** Maintains an immutable, tamper-evident audit log of all critical system events for corporate governance and regulatory compliance.
- **Access Rule:** Restricted strictly to the `ADMIN` role.
- **Backend Components:**
  - Route: `apps/api/src/modules/audit/audit.route.ts`
  - Service: `apps/api/src/modules/audit/audit.service.ts`
- **Key Functionality:**
  - Tracked Actions: User creations, role modifications, contract changes, payrun calculations, payrun validations, leave approvals/rejections, and payment status updates.
  - Actor Metadata: Records actor user ID, client IP address, User-Agent header, action type, entity type, entity ID, and timestamp.
  - Zero Mutation: The `audit_logs` table exposes **no update or delete endpoints**, ensuring complete immutability.
- **Frontend Views:**
  - `apps/web/src/pages/audit/audit-logs-page.tsx`: Chronological event stream with action filters, entity type filters, and a JSON payload inspector modal.

---

## 8. The Deterministic Calculation Engine (Deep Dive)

The payroll calculation engine in `apps/api/src/modules/payroll/payroll-engine.service.ts` is completely deterministic, avoiding floating-point imprecision and security risks associated with script evaluation.

### The Algorithm:

```typescript
// Deterministic Calculation Flow
export function calculateEmployeePayroll(
  baseSalary: Prisma.Decimal | number | string,
  rules: PayrollRuleInput[],
  existingWarnings: string[] = [],
): CalculatedEmployeePayroll {
  const baseSalaryDecimal = new Prisma.Decimal(baseSalary)
  let grossEarnings = new Prisma.Decimal(baseSalaryDecimal)
  let totalDeductions = new Prisma.Decimal(0)

  const lineItems: PayrollLineItem[] = []
  const warnings = [...existingWarnings]

  // 1. Sort active rules strictly by sequence ascending
  const sortedRules = [...rules]
    .filter((r) => r.isActive !== false)
    .sort((a, b) => a.sequence - b.sequence)

  // 2. Evaluate each rule in sequence
  for (const rule of sortedRules) {
    let baseAmount = new Prisma.Decimal(0)
    let rateOrPercentage = new Prisma.Decimal(0)
    let computedAmount = new Prisma.Decimal(0)

    if (rule.calculationType === SalaryRuleCalculationType.FIXED) {
      rateOrPercentage = rule.amount ? new Prisma.Decimal(rule.amount) : new Prisma.Decimal(0)
      computedAmount = rateOrPercentage
      baseAmount = rateOrPercentage
    } else if (rule.calculationType === SalaryRuleCalculationType.PERCENTAGE) {
      rateOrPercentage = rule.percentage ? new Prisma.Decimal(rule.percentage) : new Prisma.Decimal(0)
      baseAmount = rule.base === SalaryRuleBase.GROSS_EARNINGS ? grossEarnings : baseSalaryDecimal
      // Exact Decimal math: baseAmount * rateOrPercentage / 100
      computedAmount = baseAmount.times(rateOrPercentage).dividedBy(100)
    }

    lineItems.push({
      ruleId: rule.id,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      calculationType: rule.calculationType,
      baseAmount: baseAmount.toFixed(2),
      rateOrPercentage: rateOrPercentage.toString(),
      amount: computedAmount.toFixed(2),
      sequence: rule.sequence,
      isTaxable: rule.isTaxable ?? true,
    })

    // 3. Accumulate earnings or deductions
    if (rule.category === SalaryRuleCategory.EARNING) {
      grossEarnings = grossEarnings.plus(computedAmount)
    } else if (rule.category === SalaryRuleCategory.DEDUCTION) {
      totalDeductions = totalDeductions.plus(computedAmount)
    }
  }

  // 4. Compute final net pay
  const netAmount = grossEarnings.minus(totalDeductions)

  return {
    baseSalary: baseSalaryDecimal,
    grossAmount: grossEarnings,
    deductionAmount: totalDeductions,
    netAmount,
    lineItems,
    warnings,
    warningCount: warnings.length,
  }
}
```

### Concrete Calculation Example:

| Step | Rule Code | Rule Name | Category | Type | Base Target | Value | Computed Amount | Running Gross | Running Deductions | Running Net |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| - | `INITIAL` | Base Salary | - | - | - | - | - | **$5,000.00** | $0.00 | $5,000.00 |
| 1 | `HRA` | House Rent Allowance | EARNING | PERCENTAGE | BASE_SALARY | 20.00% | +$1,000.00 | **$6,000.00** | $0.00 | $6,000.00 |
| 2 | `TRANS` | Transport Allowance | EARNING | FIXED | - | $300.00 | +$300.00 | **$6,300.00** | $0.00 | $6,300.00 |
| 3 | `PF` | Provident Fund | DEDUCTION | PERCENTAGE | BASE_SALARY | 12.00% | $600.00 | $6,300.00 | **+$600.00** | $5,700.00 |
| 4 | `IT` | Income Tax | DEDUCTION | PERCENTAGE | GROSS_EARNINGS | 10.00% | $630.00 | $6,300.00 | **+$1,230.00** | **$5,070.00** |

*Notice:* Step 4 computes 10% on `GROSS_EARNINGS` ($6,300.00), resulting in $630.00, rather than 10% on base salary ($5,000.00), demonstrating the power of rule sequencing.

---

## 9. Complete Database Entity-Relationship Schema & Prisma Models

PeoplePay360 uses PostgreSQL managed via Prisma ORM 7 with 12 sequential migrations.

### Enums (15):
- `UserRole`: `EMPLOYEE`, `HR_MANAGER`, `PAYROLL_USER`, `PAYROLL_MANAGER`, `ADMIN`
- `EmploymentStatus`: `ACTIVE`, `ON_LEAVE`, `NOTICE_PERIOD`, `RESIGNED`, `TERMINATED`, `INACTIVE`
- `ContractStatus`: `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`, `CANCELLED`
- `DayOfWeek`: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`
- `AttendanceStatus`: `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`
- `AttendanceSource`: `WEB`, `KIOSK`, `MANUAL`
- `LeaveRequestStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`
- `SalaryRuleCategory`: `EARNING`, `DEDUCTION`
- `SalaryRuleCalculationType`: `FIXED`, `PERCENTAGE`
- `SalaryRuleBase`: `BASE_SALARY`, `GROSS_EARNINGS`
- `PayrunStatus`: `DRAFT`, `CALCULATED`, `VALIDATED`, `CANCELLED`
- `PaymentStatus`: `UNPAID`, `PROCESSING`, `PAID`, `FAILED`
- `PayslipStatus`: `DRAFT`, `FINAL`
- `DeliveryChannel`: `EMAIL`
- `DeliveryStatus`: `PENDING`, `SENT`, `FAILED`

### Models (17):

1. **`User` (`users`)**: System credentials, role, active status, last login timestamp.
2. **`RefreshToken` (`refresh_tokens`)**: Hashed refresh tokens, user foreign key, `familyId`, expiry, revocation timestamp.
3. **`Department` (`departments`)**: Organizational units with unique code and name.
4. **`JobPosition` (`job_positions`)**: Job classifications with unique code and title.
5. **`Employee` (`employees`)**: Master employee profile, names, email, phone, joining date, status, department, position, user link, and manager hierarchy.
6. **`EmployeeContract` (`employee_contracts`)**: Employment contract record, contract number, base salary, currency, date range, status.
7. **`WorkSchedule` (`work_schedules`)**: Work schedule template with code, name, and timezone.
8. **`WorkScheduleDay` (`work_schedule_days`)**: Day-of-week shift rules, working day flag, start/end times, break minutes, expected minutes.
9. **`EmployeeScheduleAssignment` (`employee_schedule_assignments`)**: Maps an employee to a work schedule for an effective date range.
10. **`Attendance` (`attendances`)**: Daily shift attendance, check-in/out timestamps, worked minutes, status, and source.
11. **`LeaveType` (`leave_types`)**: Time-off classifications (Annual, Sick, etc.) and paid status flags.
12. **`LeaveAllocation` (`leave_allocations`)**: Annual leave quota balances per employee and leave type for a given calendar year.
13. **`LeaveRequest` (`leave_requests`)**: Leave applications with date range, requested days count, reason, status, reviewer notes, and review timestamps.
14. **`SalaryStructure` (`salary_structures`)**: Reusable salary structures containing an ordered set of rules.
15. **`SalaryRule` (`salary_rules`)**: Individual earning or deduction rules, calculation type, amount/percentage, base target, and sequence.
16. **`EmployeeSalaryStructureAssignment` (`employee_salary_structure_assignments`)**: Maps an employee to a salary structure for an effective date range.
17. **`Payrun` (`payruns`)**: Payrun cycle period, status, calculated aggregates (total gross, deductions, net), and validation timestamps.
18. **`PayrunEmployee` (`payrun_employees`)**: Calculated payroll record for an employee in a payrun, containing contract and structure JSON snapshots, line items, and warnings.
19. **`Payslip` (`payslips`)**: Official payslip record generated from a validated payrun with payment status tracking.
20. **`PayslipLine` (`payslip_lines`)**: Itemized breakdown lines for a payslip, snapshotting rule name, category, sequence, and amount.
21. **`PayslipDelivery` (`payslip_deliveries`)**: Tracks email delivery attempts for a payslip with recipient, status, and error details.
22. **`AuditLog` (`audit_logs`)**: Immutable log of system actions with actor details, action type, entity references, client IP, and sanitized metadata.

---

## 10. Complete REST API Specification (83 Endpoints)

Every API route is mounted under `/api/v1` and protected by authentication and role middleware.

```
System & Health (1)
  GET    /api/v1/health                                 Public health probe

Authentication & Sessions (4)
  POST   /api/v1/auth/login                             Login (email, password) -> JWT + HttpOnly Cookie
  POST   /api/v1/auth/refresh                           Rotate refresh token -> new JWT + Cookie
  POST   /api/v1/auth/logout                            Revoke refresh token & clear cookies
  GET    /api/v1/auth/me                                Authenticated user profile & role

Role Boundary Probes (5)
  GET    /api/v1/access/admin                           ADMIN only probe
  GET    /api/v1/access/hr                              HR_MANAGER / ADMIN probe
  GET    /api/v1/access/payroll                         PAYROLL_USER / PAYROLL_MANAGER / ADMIN probe
  GET    /api/v1/access/payroll-manager                 PAYROLL_MANAGER / ADMIN probe
  GET    /api/v1/access/employee                        EMPLOYEE and all authenticated roles probe

User Administration (6)
  POST   /api/v1/users                                  ADMIN: Provision new user account
  GET    /api/v1/users                                  ADMIN: List user accounts (paginated, search)
  GET    /api/v1/users/:id                              ADMIN: Retrieve single user account
  PATCH  /api/v1/users/:id/role                         ADMIN: Update user role
  PATCH  /api/v1/users/:id/status                       ADMIN: Toggle user active status
  POST   /api/v1/users/:id/reset-password               ADMIN: Administrative password reset

Departments (5)
  POST   /api/v1/departments                           HR_MANAGER / ADMIN: Create department
  GET    /api/v1/departments                           All authenticated: List departments
  GET    /api/v1/departments/:id                       All authenticated: Get department details
  PATCH  /api/v1/departments/:id                       HR_MANAGER / ADMIN: Update department
  DELETE /api/v1/departments/:id                       HR_MANAGER / ADMIN: Delete department

Job Positions (5)
  POST   /api/v1/job-positions                         HR_MANAGER / ADMIN: Create job position
  GET    /api/v1/job-positions                         All authenticated: List job positions
  GET    /api/v1/job-positions/:id                     All authenticated: Get job position details
  PATCH  /api/v1/job-positions/:id                     HR_MANAGER / ADMIN: Update job position
  DELETE /api/v1/job-positions/:id                     HR_MANAGER / ADMIN: Delete job position

Employees & Bulk Import (9)
  POST   /api/v1/employees/bulk-import                 HR_MANAGER / ADMIN: Bulk Excel employee import
  POST   /api/v1/employees                             HR_MANAGER / ADMIN: Create employee
  GET    /api/v1/employees                             HR / PAYROLL / ADMIN: List employees (paginated)
  GET    /api/v1/employees/:id                         HR / PAYROLL / ADMIN: Get employee 360 profile
  PATCH  /api/v1/employees/:id                         HR_MANAGER / ADMIN: Update employee details
  PATCH  /api/v1/employees/:id/status                  HR_MANAGER / ADMIN: Update employment status
  PATCH  /api/v1/employees/:id/manager                 HR_MANAGER / ADMIN: Assign reporting manager
  PATCH  /api/v1/employees/:id/link-user               HR_MANAGER / ADMIN: Link employee to user account
  PATCH  /api/v1/employees/:id/unlink-user             HR_MANAGER / ADMIN: Unlink employee user account

Employment Contracts (5)
  POST   /api/v1/contracts                             HR / PAYROLL_MANAGER / ADMIN: Create contract
  GET    /api/v1/contracts                             HR / PAYROLL / ADMIN: List contracts
  GET    /api/v1/contracts/:id                         HR / PAYROLL / ADMIN: Get contract details
  PATCH  /api/v1/contracts/:id                         HR / PAYROLL_MANAGER / ADMIN: Update contract
  PATCH  /api/v1/contracts/:id/status                  HR / PAYROLL_MANAGER / ADMIN: Update contract status

Work Schedules & Assignments (6)
  POST   /api/v1/work-schedules                        HR_MANAGER / ADMIN: Create work schedule template
  GET    /api/v1/work-schedules                        HR / PAYROLL / ADMIN: List work schedules
  GET    /api/v1/work-schedules/:id                    HR / PAYROLL / ADMIN: Get schedule details & days
  PATCH  /api/v1/work-schedules/:id                    HR_MANAGER / ADMIN: Update schedule & day shifts
  POST   /api/v1/work-schedules/assignments            HR_MANAGER / ADMIN: Assign schedule to employee
  GET    /api/v1/work-schedules/assignments/employee/:employeeId  HR / PAYROLL / ADMIN: Get assignments

Attendance & Digital Punch Clock (5)
  POST   /api/v1/attendance/check-in                   All authenticated: Punch in for current employee
  POST   /api/v1/attendance/check-out                  All authenticated: Punch out for current employee
  POST   /api/v1/attendance/manual                     HR_MANAGER / ADMIN: Manual attendance record
  GET    /api/v1/attendance                            HR_MANAGER / ADMIN: List all attendance logs
  GET    /api/v1/attendance/employee/:employeeId       HR / ADMIN or Self: Get employee attendance

Leave Policies, Quotas & Requests (12)
  POST   /api/v1/leave-types                           HR_MANAGER / ADMIN: Create leave category
  GET    /api/v1/leave-types                           All authenticated: List leave categories
  PATCH  /api/v1/leave-types/:id                       HR_MANAGER / ADMIN: Update leave category
  POST   /api/v1/leave-allocations                     HR_MANAGER / ADMIN: Allocate annual quota
  GET    /api/v1/leave-allocations                     HR / PAYROLL / ADMIN: List quota allocations
  GET    /api/v1/leave-allocations/employee/:employeeId  HR / ADMIN or Self: Get quota balances
  POST   /api/v1/leave-requests                        All authenticated: Submit leave request
  GET    /api/v1/leave-requests                        HR_MANAGER / ADMIN: List leave requests queue
  GET    /api/v1/leave-requests/me                     All authenticated: List own leave requests
  GET    /api/v1/leave-requests/:id                    HR / ADMIN or Self: Get leave request details
  PATCH  /api/v1/leave-requests/:id/review             HR_MANAGER / ADMIN: Approve or reject leave
  POST   /api/v1/leave-requests/:id/cancel             All authenticated: Cancel own pending leave

Salary Structures & Declarative Rules (9)
  POST   /api/v1/salary-structures                     PAYROLL_MANAGER / ADMIN: Create salary structure
  GET    /api/v1/salary-structures                     PAYROLL / ADMIN: List salary structures
  GET    /api/v1/salary-structures/:id                 PAYROLL / ADMIN: Get structure & ordered rules
  PATCH  /api/v1/salary-structures/:id                 PAYROLL_MANAGER / ADMIN: Update salary structure
  POST   /api/v1/salary-structures/:id/rules           PAYROLL_MANAGER / ADMIN: Add rule to structure
  PATCH  /api/v1/salary-structures/:structureId/rules/:ruleId  PAYROLL_MANAGER / ADMIN: Update rule
  DELETE /api/v1/salary-structures/:structureId/rules/:ruleId  PAYROLL_MANAGER / ADMIN: Delete rule
  POST   /api/v1/employees/:employeeId/salary-structures       PAYROLL_MGR / ADMIN: Assign structure
  GET    /api/v1/employees/:employeeId/salary-structures       PAYROLL / ADMIN: Get assignments

Payroll Cycles & Calculations (7)
  POST   /api/v1/payruns                               PAYROLL_MANAGER / ADMIN: Create payrun cycle
  GET    /api/v1/payruns                               PAYROLL / ADMIN: List payrun cycles
  GET    /api/v1/payruns/:id                           PAYROLL / ADMIN: Get payrun cycle summary
  POST   /api/v1/payruns/:id/calculate                 PAYROLL_MANAGER / ADMIN: Run batch calculations
  POST   /api/v1/payruns/:id/validate                  PAYROLL_MANAGER / ADMIN: Validate & freeze payrun
  POST   /api/v1/payruns/:id/cancel                    PAYROLL_MANAGER / ADMIN: Cancel payrun cycle
  GET    /api/v1/payruns/:id/calculations              PAYROLL / ADMIN: Get calculation records

Payslips, PDF & Email Delivery (8)
  POST   /api/v1/payruns/:id/payslips                  PAYROLL_MANAGER / ADMIN: Generate payslips
  GET    /api/v1/payslips                              PAYROLL / ADMIN: List payslips (filterable)
  GET    /api/v1/payslips/me                           All authenticated: List personal payslips
  GET    /api/v1/payslips/:id                          PAYROLL / ADMIN or Self: Get payslip details
  PATCH  /api/v1/payslips/:id/payment-status           PAYROLL_MANAGER / ADMIN: Update payment status
  GET    /api/v1/payslips/:id/pdf                      PAYROLL / ADMIN or Self: Download vector PDF
  POST   /api/v1/payslips/:id/email                    PAYROLL_MANAGER / ADMIN: Dispatch single email
  POST   /api/v1/payruns/:id/email-payslips            PAYROLL_MANAGER / ADMIN: Bulk email payrun slips

Role Dashboards (3)
  GET    /api/v1/dashboard/hr                          HR_MANAGER / ADMIN: Headcount, shifts, leaves
  GET    /api/v1/dashboard/payroll                     PAYROLL / ADMIN: Gross totals, net pay, warnings
  GET    /api/v1/dashboard/me                          All authenticated: Self-service punch, leave, slips

Audit Logs (1)
  GET    /api/v1/audit-logs                            ADMIN only: Query append-only audit stream
```

---

## 11. Frontend Architecture, UI Design System & Aesthetics

PeoplePay360 features a cohesive visual design built on modern web standards.

```
+-------------------------------------------------------------------------+
|                  TOPBAR NAVIGATION & USER PROFILE BADGE                 |
+-------------------+-----------------------------------------------------+
| SIDEBAR NAVIGATION| MAIN CONTENT WORKSPACE                              |
|                   |                                                     |
| - Overview        | [ Fluid Animated SVG Wave Background Canvas ]       |
| - HR Operations   |                                                     |
| - Payroll & Comp  | [ Role-Tailored KPI Metric Cards with Glowing Ring ]|
| - My Self-Service |                                                     |
| - Administration  | [ Paginated Tables with Accessible Base UI Dialogs ]|
|                   |                                                     |
+-------------------+-----------------------------------------------------+
```

### Aesthetic Specifications:

1. **Curated Color Palette**:
   - Primary: Deep Oceanic Navy (`#082366` / `oklch(0.32 0.16 260)`)
   - Accent & Highlights: Soft Periwinkle (`#c7d4fc` / `oklch(0.88 0.08 260)`)
   - Dark Mode: Midnight Oceanic (`oklch(0.10 0.035 260)`)
2. **Animated Wave Canvas Physics (`wave-background.tsx`)**:
   - Renders multi-layered SVG sine-wave curves with subtle gradient fills, providing depth without impacting performance.
3. **Password View Toggle**:
   - Integrated into the login form with `Eye` / `EyeOff` icons, allowing users to verify their password while preserving browser autofill compatibility.
4. **Interactive Micro-Animations**:
   - CSS-driven smooth hover transitions (`scale-[1.01]`, `transition-all duration-300`), active route badges, pulsing attendance status dots, and glassmorphic card borders.
5. **Accessible Component Layer**:
   - Built on `@base-ui/react` primitives using standard React composition (`render={<Link to="..." />}`), completely avoiding non-standard `asChild` patterns.

---

## 12. Setup, Installation & Local Development Guide

### Prerequisites:
- **Node.js**: `v22.x` (ESM native support required)
- **PostgreSQL**: `v15+` (running on `localhost:5432` or via cloud provider)
- **Package Manager**: `npm` (workspaces enabled)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/sandy11e/PeoplePay360-Straw-Hats.git
cd PeoplePay360-Straw-Hats

# Install dependencies across all workspaces
npm install
```

### Step 2: Configure Environment Variables

**Backend (`apps/api/.env`):**
```env
# Server Runtime
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://peoplepay360_app:peoplepay360_secret@localhost:5432/peoplepay360?schema=public"

# Security & JWT Secrets (Use strong random strings in production)
JWT_SECRET="peoplepay360_super_secret_jwt_key_dev_mode_minimum_32_chars_long"
REFRESH_TOKEN_SECRET="peoplepay360_super_secret_refresh_token_dev_mode_minimum_32_chars"

# SMTP Email Configuration
# Note: Leave empty to use the built-in in-memory transport for local development and testing
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="PeoplePay360 Payroll <payroll@peoplepay360.local>"
```

**Frontend (`apps/web/.env`):**
```env
VITE_API_URL=http://localhost:3000/api/v1
```

### Step 3: Run Database Migrations
```bash
# Push all 12 migrations to the PostgreSQL instance
npx -w @peoplepay360/api prisma migrate deploy

# Generate the typed Prisma Client
npx -w @peoplepay360/api prisma generate
```

### Step 4: Seed Database
```bash
# Provision initial Administrator account
npm run seed:admin -w @peoplepay360/api

# Provision demo accounts across all 5 roles with schedules and leaves
npx tsx apps/api/src/scripts/seed-demo-users.ts
```

### Step 5: Start Development Servers
You can run both servers concurrently in separate terminal sessions:

```bash
# Terminal 1: Backend API (runs on http://localhost:3000)
npm run dev -w @peoplepay360/api

# Terminal 2: Frontend Web Client (runs on http://localhost:5173)
npm run dev -w web
```

---

## 13. Automated Testing & Quality Verification

PeoplePay360 includes automated test suites covering both the backend API and frontend client.

### Backend Verification Suite:
- **Command:** `npm test -w @peoplepay360/api`
- **Runner:** Node.js native test runner + Supertest against live PostgreSQL
- **Coverage:** 15 test suites, **64 tests passed, 0 failures**

```
Suites Executed:
  1. access.test.ts (7 tests) - Role-based authorization & 401/403 status enforcement
  2. auth.test.ts (8 tests) - Login, password verification, hashing, token issuance
  3. tokens.test.ts (6 tests) - Access token signing, claims verification, expiration
  4. refresh.test.ts (8 tests) - Token rotation, family tracking, reuse detection
  5. payslip.test.ts (7 tests) - Payslip calculations and line item snapshotting
  6. backend-verification.test.ts (28 tests across 5 categories):
     - Suite 1: Authentication & Session Security (7 tests)
     - Suite 2: End-to-End Core Lifecycle Flow (11 tests)
     - Suite 3: RBAC Least Privilege Matrix (3 tests)
     - Suite 4: Cross-User Data Isolation (3 tests)
     - Suite 5: Security Hardening & Robustness (4 tests)
```

### Frontend Verification Suite:
- **Command:** `npm test -w web`
- **Runner:** Vitest 3.0
- **Coverage:** **28 tests passed, 0 failures**

```
Suites Executed:
  1. format.test.ts - Currency, date, time, and minute formatters
  2. roles.test.ts - Role predicates (isAdmin, isHr, isPayroll, isEmployee)
  3. api-error.test.ts - Structured API error parsing
  4. sidebar.test.ts - Role-based navigation visibility filtering
```

### Production Build & Typecheck Verification:
```bash
# Typecheck entire monorepo
npm run typecheck -w @peoplepay360/api
npm run typecheck -w web

# Build for production
npm run build -w @peoplepay360/api
npm run build -w web
```

---

## 14. Default Seed Data & Demo Credentials

The database seeding scripts create ready-to-use demo accounts across all 5 system roles:

| Role | Email Address | Password | Linked Employee Code | Default Assigned Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@peoplepay360.local` | `Password123!` | `EMP-ADM-001` | Full administrative access across all modules, users, and audit logs |
| **HR_MANAGER** | `hr@peoplepay360.local` | `Password123!` | `EMP-HRM-001` | Full operational access to Employees, Bulk Import, Attendance, and Leaves |
| **PAYROLL_MANAGER** | `payroll@peoplepay360.local` | `Password123!` | `EMP-PAY-001` | Full access to Salary Structures, Payrun Calculations, Validation, and Payslips |
| **PAYROLL_USER** | `payrolluser@peoplepay360.local` | `Password123!` | `EMP-PAY-002` | Operational access to view calculations and payruns (validation restricted) |
| **EMPLOYEE** | `employee@peoplepay360.local` | `Password123!` | `EMP-DEMO-001` | Self-Service Portal (Punch Clock, Personal Leaves, Personal Payslips) |

> [!NOTE]
> All demo accounts are seeded with active contracts, assigned to the `STD-40H` work schedule, and allocated 25 days of annual leave.

---

## 15. Troubleshooting & Frequently Asked Questions

### Q1: Why am I receiving a 401 Unauthorized error after refreshing the page?
**Answer:** The frontend stores the access token in React memory for security. On page refresh, the client automatically calls `POST /api/v1/auth/refresh` using the `HttpOnly` cookie to obtain a new access token. If this fails, verify that:
1. The backend server is running on `http://localhost:3000`.
2. Browser cookies are enabled for `localhost`.
3. `CORS_ORIGIN` in `apps/api/.env` matches your frontend URL (`http://localhost:5173`).

### Q2: How do I configure real email delivery instead of the mock transport?
**Answer:** In `apps/api/.env`, provide valid SMTP credentials:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="PeoplePay360 <your-email@gmail.com>"
```
Restart the API server. All payslip PDF emails will now be delivered to real recipient inboxes via SSL/TLS.

### Q3: Why does payrun validation freeze the payrun?
**Answer:** In compliance with financial audit standards, validated payruns are strictly immutable. Once validated, payslips and line items are permanently snapshot into the database so that future contract or salary rule changes cannot alter past payroll records.

---

*PeoplePay360 — Precision HR and Payroll Engineering for the Enterprise.*
