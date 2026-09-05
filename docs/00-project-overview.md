# PeoplePay360

PeoplePay360 is an integrated HR and Payroll Management System being developed for the Odoo Hackathon 2026.

## Core Flow

Employee
→ Contract
→ Work Schedule
→ Attendance / Leave
→ Salary Structure
→ Salary Rules
→ Payrun
→ Payslip
→ Payroll History and Dashboard

## Major Modules

1. Authentication and Role-Based Access
2. Employee Management
3. Employee Contracts
4. Work Schedules
5. Attendance Management
6. Leave Management
7. Salary Structures
8. Salary Rules
9. Payroll Processing
10. Payslips
11. PDF and Email
12. HR and Payroll Dashboard
13. Audit and History

## Roles

- Employee
- HR Manager
- Payroll User
- Payroll Manager
- Administrator

## Technology Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- TypeScript
- Express
- REST API
- Zod

### Database
- PostgreSQL
- Prisma ORM

### Authentication
- JWT access tokens
- Refresh tokens

### Testing
- Vitest
- Supertest

## Repository Structure

peoplepay360/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
└── docs/

## Development Principle

Build the system incrementally while maintaining correctness, security, testability, auditability, and clear domain boundaries.
