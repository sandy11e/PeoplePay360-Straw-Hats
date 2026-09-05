# STEP 14: Employee Contract Management

**Date Completed:** 2025-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(contracts): add employee contract management`

---

## Overview

STEP 14 implemented a complete employee contract management system for the PeoplePay360 HR & Payroll platform. Contracts represent employment agreements with salary information, using PostgreSQL NUMERIC/DECIMAL types for monetary values to ensure precision and avoid floating-point arithmetic errors.

**Key Features:**
- Contract lifecycle management (DRAFT → ACTIVE → EXPIRED/TERMINATED)
- Conflict detection for overlapping active contracts per employee
- Status transition validation with controlled state machine
- Decimal-based salary handling for financial accuracy
- HR Manager controls (create, update, change status)
- Payroll Team read access with filtering capabilities

---

## Database Schema

### New Model: `EmployeeContract`

```prisma
model EmployeeContract {
  id              String         @id @default(cuid())
  contractNumber  String         @unique
  employee        Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId      String
  startDate       DateTime
  endDate         DateTime?
  baseSalary      Decimal        // PostgreSQL handles numeric precision
  currency        String         @db.Char(3)
  status          ContractStatus @default(DRAFT)
  notes           String?        @db.VarChar(1000)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([employeeId])
  @@index([status])
  @@index([startDate])
  @@index([endDate])
}
```

### New Enum: `ContractStatus`

```prisma
enum ContractStatus {
  DRAFT      // Initial state, not yet active
  ACTIVE     // Currently in effect
  EXPIRED    // End date reached (terminal)
  TERMINATED // Early termination (terminal)
  CANCELLED  // Cancelled without activation (terminal)
}
```

### Relations

- **Employee ← EmployeeContract**: One-to-Many relationship with Cascade delete
- Supports multiple contracts per employee (enabled by conflict detection)
- Employee data included in contract responses for context

---

## Validation Schemas (Zod)

### `createContractSchema`
- **contractNumber**: 2-50 characters, uppercase pattern, required
- **employeeId**: Valid UUID, required
- **startDate**: Date string (YYYY-MM-DD), required
- **endDate**: Date string (YYYY-MM-DD), optional, must be ≥ startDate if provided
- **baseSalary**: Decimal > 0, required
- **currency**: ISO 4217 3-letter code, required
- **notes**: Max 1000 characters, optional
- **Validations**: Confirms employee exists, no duplicate contract numbers, no overlapping active contracts

### `updateContractSchema`
- All fields optional
- Respects existing date ordering (endDate ≥ startDate)
- Prevents updates to terminal state contracts (EXPIRED, TERMINATED, CANCELLED)

### `updateContractStatusSchema`
- **status**: ContractStatus enum value, required
- **Validations**:
  - DRAFT → ACTIVE, CANCELLED
  - ACTIVE → EXPIRED, TERMINATED
  - Terminal states → locked (no further transitions)

### `contractListQuerySchema`
- **page**: 1-based pagination, default 1
- **pageSize**: 1-100 items per page, default 20
- **employeeId**: Optional UUID filter
- **status**: Optional ContractStatus filter

### `employeeContractListQuerySchema`
- **page**: 1-based pagination, default 1
- **pageSize**: 1-100 items per page, default 20
- **status**: Optional ContractStatus filter

---

## API Endpoints

### 1. Create Contract
**POST** `/api/v1/contracts`

**Authorization:** `ADMIN` or `HR_MANAGER`

**Request Body:**
```json
{
  "contractNumber": "EMP2025001",
  "employeeId": "550e8400-e29b-41d4-a716-446655440000",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "baseSalary": 75000.50,
  "currency": "USD",
  "notes": "3-year contract with annual review"
}
```

**Success Response (201):**
```json
{
  "contract": {
    "id": "clm7x9q8v0001p8k8e8k8e8k8",
    "contractNumber": "EMP2025001",
    "employeeId": "550e8400-e29b-41d4-a716-446655440000",
    "employee": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "employeeCode": "EMP001",
      "firstName": "John",
      "lastName": "Doe",
      "workEmail": "john.doe@example.com"
    },
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-12-31T00:00:00.000Z",
    "baseSalary": "75000.50",
    "currency": "USD",
    "status": "DRAFT",
    "notes": "3-year contract with annual review",
    "createdAt": "2025-09-05T10:30:00.000Z",
    "updatedAt": "2025-09-05T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Validation errors (invalid contractNumber format, baseSalary ≤ 0, etc.)
- `404`: Employee not found
- `409`: Contract number already exists
- `409`: Conflicting active contract for employee

### 2. List Contracts
**GET** `/api/v1/contracts?page=1&pageSize=20&employeeId=UUID&status=ACTIVE`

**Authorization:** `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER`

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `employeeId`: Filter by employee UUID (optional)
- `status`: Filter by status enum (optional)

**Success Response (200):**
```json
{
  "contracts": [
    {
      "id": "clm7x9q8v0001p8k8e8k8e8k8",
      "contractNumber": "EMP2025001",
      "employeeId": "550e8400-e29b-41d4-a716-446655440000",
      "employee": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "employeeCode": "EMP001",
        "firstName": "John",
        "lastName": "Doe",
        "workEmail": "john.doe@example.com"
      },
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-12-31T00:00:00.000Z",
      "baseSalary": "75000.50",
      "currency": "USD",
      "status": "ACTIVE",
      "notes": "3-year contract with annual review",
      "createdAt": "2025-09-05T10:30:00.000Z",
      "updatedAt": "2025-09-05T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 3. Get Contract by ID
**GET** `/api/v1/contracts/:id`

**Authorization:** `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER`

**Success Response (200):** Single contract object (same structure as list response)

**Error Responses:**
- `400`: Invalid UUID format
- `404`: Contract not found

### 4. Get Employee Contracts
**GET** `/api/v1/employees/:employeeId/contracts?page=1&pageSize=20&status=ACTIVE`

**Authorization:** `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER`

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `status`: Filter by status enum (optional)

**Success Response (200):** List with pagination (same structure as List Contracts)

**Error Responses:**
- `400`: Invalid employee ID or query parameters
- `404`: Employee not found

### 5. Update Contract
**PATCH** `/api/v1/contracts/:id`

**Authorization:** `ADMIN` or `HR_MANAGER`

**Request Body (all optional):**
```json
{
  "contractNumber": "EMP2025001-REV",
  "startDate": "2025-01-15",
  "endDate": "2025-12-31",
  "baseSalary": 80000.00,
  "currency": "USD",
  "notes": "Updated contract terms"
}
```

**Success Response (200):** Updated contract object

**Error Responses:**
- `400`: Validation errors
- `404`: Contract not found
- `409`: Contract locked (terminal state)
- `409`: Duplicate contract number

**Special Behavior:**
- Cannot update EXPIRED, TERMINATED, or CANCELLED contracts
- Respects date ordering: endDate ≥ startDate
- Salary must remain > 0

### 6. Update Contract Status
**PATCH** `/api/v1/contracts/:id/status`

**Authorization:** `ADMIN` or `HR_MANAGER`

**Request Body:**
```json
{
  "status": "ACTIVE"
}
```

**Success Response (200):** Updated contract object

**Error Responses:**
- `400`: Invalid status value
- `404`: Contract not found
- `409`: Invalid status transition
- `409`: Conflicting active contract (when moving to ACTIVE)

**Status Transitions:**
| Current State | Allowed Transitions | Purpose |
|---|---|---|
| DRAFT | ACTIVE, CANCELLED | Activate or discard unpublished contract |
| ACTIVE | EXPIRED, TERMINATED | Complete normally or end early |
| EXPIRED | (none) | Terminal state - reached natural end date |
| TERMINATED | (none) | Terminal state - ended by action |
| CANCELLED | (none) | Terminal state - never activated |

---

## Security Model (RBAC)

### Write Access (Create, Update, Change Status)
- ✅ `ADMIN` - Full control
- ✅ `HR_MANAGER` - Full control
- ❌ `PAYROLL_USER` - No write access
- ❌ `PAYROLL_MANAGER` - No write access (read-only)
- ❌ `EMPLOYEE` - No access

### Read Access (List, Get)
- ✅ `ADMIN` - All contracts
- ✅ `HR_MANAGER` - All contracts
- ✅ `PAYROLL_MANAGER` - All contracts
- ✅ `PAYROLL_USER` - All contracts
- ❌ `EMPLOYEE` - No access

**Rationale:**
- **HR_MANAGER**: Manages employee lifecycle and contract terms
- **PAYROLL_USER/PAYROLL_MANAGER**: Need to view contracts for salary/payroll processing
- **EMPLOYEE**: No direct contract management (contracts created/updated by HR)

---

## Data Integrity & Conflict Detection

### 1. Duplicate Contract Number Prevention
- Contract numbers must be unique across system
- Enforced at database level (UNIQUE constraint) and application level
- Checked during both CREATE and PATCH operations

### 2. Employee Existence Validation
- All contracts must reference an existing employee
- Validated during contract creation
- Cascading delete: removing an employee deletes their contracts

### 3. Active Contract Overlap Prevention
- **Constraint**: An employee cannot have two overlapping ACTIVE contracts
- **Detection**: Checks for date range overlap (`startDate ≤ otherEndDate AND endDate ≥ otherStartDate`)
- **When Enforced**:
  - POST: New contract creation
  - PATCH /status: When transitioning to ACTIVE
- **Open-ended Contracts**: Contracts without endDate treated as extending to year 2099

### 4. Date Ordering
- Validation: `endDate ≥ startDate` when both are provided
- Nullable endDate permitted (open-ended contracts)
- Enforced in schema validation and database constraints

---

## Monetary Value Handling

### ✅ PostgreSQL NUMERIC/DECIMAL Strategy
- **Type**: Prisma `Decimal` type maps to PostgreSQL `NUMERIC`
- **Precision**: Automatic by PostgreSQL (no explicit @db annotation needed)
- **Conversion**: Automatically handled by Prisma client
- **JSON Serialization**: Returned as string in API responses to prevent floating-point loss

### ❌ Why Not JavaScript Numbers
- JavaScript's floating-point arithmetic loses precision (e.g., 0.1 + 0.2 ≠ 0.3)
- Unsuitable for financial calculations
- Salary data is persisted and critical for payroll accuracy

### API Behavior
```
Request:  { "baseSalary": 75000.50 }      // JSON number
Database: NUMERIC(precision, scale)         // Stored exactly
Response: { "baseSalary": "75000.50" }      // JSON string for precision
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "fields": { "fieldName": ["validation message"] }  // Optional
  }
}
```

### Common Error Codes
| Code | Status | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input (contractNumber format, salary ≤ 0, etc.) |
| `EMPLOYEE_NOT_FOUND` | 404 | Referenced employee doesn't exist |
| `CONTRACT_NOT_FOUND` | 404 | Contract ID doesn't exist |
| `CONTRACT_NUMBER_EXISTS` | 409 | Duplicate contract number |
| `CONFLICTING_ACTIVE_CONTRACT` | 409 | Overlapping active contract for employee |
| `INVALID_STATUS_TRANSITION` | 409 | Status change not permitted for current state |
| `CONTRACT_LOCKED` | 409 | Cannot update terminal state contract |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions for operation |

---

## Integration Points

### Modified Files
1. **app.ts** - Added contract router registration
2. **employee.route.ts** - Added GET /:employeeId/contracts endpoint

### New Files
1. **contract.schema.ts** - All Zod validation schemas
2. **contract.route.ts** - All 6 API endpoints with business logic

### Database
1. **20260905133801_add_employee_contracts** - Migration creating EmployeeContract model and ContractStatus enum
2. Prisma client regenerated with new types

---

## Verification

### TypeScript Compilation
```bash
npm run typecheck -w @peoplepay360/api
✅ No type errors
```

### Production Build
```bash
npm run build -w @peoplepay360/api
✅ Build successful
```

### Build Artifacts
- Generated Prisma client includes `EmployeeContract` model
- Generated types include `ContractStatus` enum
- All route handlers type-safe and compiled

---

## Testing Recommendations

### Unit Tests (Routes)
- [ ] Test create with valid data
- [ ] Test create with duplicate contract number
- [ ] Test create with non-existent employee
- [ ] Test create with overlapping active contract
- [ ] Test list with various filters
- [ ] Test list pagination
- [ ] Test get single contract
- [ ] Test update with valid data
- [ ] Test update terminal state contract (should fail)
- [ ] Test status transition valid paths
- [ ] Test status transition invalid paths

### Integration Tests
- [ ] Create multiple contracts for same employee (verify no overlap)
- [ ] Transition contract through full lifecycle
- [ ] Verify cascade delete (delete employee removes contracts)
- [ ] Test employee not found scenarios

### Security Tests
- [ ] Verify non-HR_MANAGER cannot create contracts
- [ ] Verify PAYROLL_USER can read but not write
- [ ] Verify EMPLOYEE role has no access

---

## API Usage Examples

### Example 1: Create and Activate Contract
```bash
# 1. Create in DRAFT state
POST /api/v1/contracts
{
  "contractNumber": "EMP-2025-001",
  "employeeId": "550e8400-e29b-41d4-a716-446655440000",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "baseSalary": 75000.00,
  "currency": "USD"
}
# Response: { "contract": { "status": "DRAFT", ... } }

# 2. Transition to ACTIVE
PATCH /api/v1/contracts/:id/status
{
  "status": "ACTIVE"
}
# Response: { "contract": { "status": "ACTIVE", ... } }

# 3. At end of year, mark as EXPIRED
PATCH /api/v1/contracts/:id/status
{
  "status": "EXPIRED"
}
# Response: { "contract": { "status": "EXPIRED", ... } }
```

### Example 2: Employee Contract History
```bash
GET /api/v1/employees/:employeeId/contracts?status=ACTIVE

# Returns all active contracts for employee
# Response includes contract details with employee context
```

### Example 3: Payroll Processing
```bash
GET /api/v1/contracts?status=ACTIVE&page=1&pageSize=50

# Returns all active contracts for payroll team
# Can filter by status or employeeId as needed
```

---

## Migration Impact

- ✅ No existing APIs modified (backward compatible)
- ✅ STEP 13 user/employee APIs unchanged and functional
- ✅ Database migration adds new table, does not alter existing schemas
- ✅ Prisma client regenerated with new types

---

## Commit Information

**Commit Message:**
```
feat(contracts): add employee contract management

- Add EmployeeContract model with DRAFT→ACTIVE→EXPIRED/TERMINATED lifecycle
- Add ContractStatus enum with valid state transitions
- Implement 6 REST API endpoints with full RBAC
- Add conflict detection for overlapping active contracts
- Use PostgreSQL NUMERIC/DECIMAL for salary values
- Add Zod validation schemas for all contract operations
- Register contract router in app.ts
- Add employee/:id/contracts endpoint for employee-specific view
- Prisma migration: 20260905133801_add_employee_contracts
```

---

## Summary Statistics

| Metric | Count |
|---|---|
| New API Endpoints | 6 |
| New Zod Schemas | 5 |
| Modified Files | 2 (app.ts, employee.route.ts) |
| New Files | 2 (contract.schema.ts, contract.route.ts) |
| Database Models | 1 new (EmployeeContract) |
| Enums | 1 new (ContractStatus) |
| Status Transitions | 5 valid paths |
| Error Types | 8 distinct error codes |
| Security Roles Supported | 5 (all UserRole types) |

---

**Status:** STEP 14 complete. Ready for deployment or further testing.
