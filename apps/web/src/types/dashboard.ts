import type { PaymentStatus } from "@/types/payslip"
import type { PayrunStatus } from "@/types/payroll"

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "ON_LEAVE"

export interface HrDashboardSummary {
  totalEmployees: number
  activeEmployees: number
  employeesOnLeave: number
  attendanceToday: {
    PRESENT: number
    LATE: number
    ABSENT: number
    HALF_DAY: number
    ON_LEAVE: number
    totalMarked: number
  }
  pendingLeaveRequests: number
  departmentCounts: Array<{
    departmentId: string
    code: string
    name: string
    activeEmployeeCount: number
  }>
  recentEmployees: Array<{
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
    joiningDate: string
    department?: { id: string; name: string } | null
    jobPosition?: { id: string; title: string } | null
  }>
}

export interface PayrollDashboardSummary {
  latestPayrun: {
    id: string
    code: string
    periodStart: string
    periodEnd: string
    status: PayrunStatus
    employeeCount: number
    totalGross: string | null
    totalDeductions: string | null
    totalNet: string | null
    calculatedAt: string | null
    validatedAt: string | null
    createdAt: string
  } | null
  payrunStatusCounts: {
    DRAFT: number
    CALCULATED: number
    VALIDATED: number
    CANCELLED: number
    total: number
  }
  grossPayroll: string
  totalDeductions: string
  netPayroll: string
  unpaidPayslipsCount: number
  payslipPaymentStatusCounts: {
    UNPAID: number
    PROCESSING: number
    PAID: number
    FAILED: number
    total: number
  }
  recentPayrollWarnings: Array<{
    id: string
    payrunId: string
    warningCount: number
    warnings: Array<{ code: string; message: string; severity: "LOW" | "MEDIUM" | "HIGH" }>
    calculatedAt: string
    payrun: { code: string }
    employee: {
      id: string
      employeeCode: string
      firstName: string
      lastName: string
    }
  }>
}

export interface EmployeeDashboardSummary {
  profile: {
    id: string
    employeeCode: string
    firstName: string
    middleName?: string | null
    lastName: string
    workEmail: string
    joiningDate: string
    department?: { id: string; name: string } | null
    jobPosition?: { id: string; title: string } | null
  }
  attendanceSummary: {
    today: {
      id: string
      checkInAt: string
      checkOutAt: string | null
      workedMinutes: number | null
      status: AttendanceStatus
      source: string
    } | null
    currentMonth: Array<{
      status: string
      count: number
    }>
  }
  leaveSummary: {
    balances: Array<{
      leaveTypeId: string
      code: string
      name: string
      isPaid: boolean
      allocatedDays: number
      usedDays: number
      remainingDays: number
    }>
    statusCounts: Record<string, number>
    recentRequests: Array<{
      id: string
      startDate: string
      endDate: string
      requestedDays: string
      reason: string
      status: string
      createdAt: string
      leaveType: {
        id: string
        name: string
      }
    }>
  }
  latestPayslip: {
    id: string
    payslipNumber: string
    periodStart: string
    periodEnd: string
    baseSalary: string
    grossAmount: string
    totalDeductions: string
    netAmount: string
    status: string
    paymentStatus: PaymentStatus
    createdAt: string
    payrun: {
      id: string
      code: string
    }
  } | null
}

export interface RoleAwareDashboardResponse {
  role: string
  hr?: HrDashboardSummary
  payroll?: PayrollDashboardSummary
  me?: EmployeeDashboardSummary
}
