import {
  AttendanceStatus,
  EmploymentStatus,
  LeaveRequestStatus,
  PaymentStatus,
  PayrunStatus,
  UserRole,
} from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"

export class DashboardError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "DashboardError"
  }
}

function getTodayUtcDate(): Date {
  const now = new Date()
  return new Date(`${now.toISOString().split("T")[0]}T00:00:00.000Z`)
}

// -------------------------------------------------------------
// HR & ADMIN DASHBOARD SUMMARY (CONFIDENTIAL: ZERO SALARY DATA)
// -------------------------------------------------------------
export async function getHrDashboardSummary(recentLimit = 5) {
  const todayDate = getTodayUtcDate()

  const [
    totalEmployees,
    activeEmployees,
    pendingLeaveRequests,
    onLeaveCount,
    attendanceGroups,
    departments,
    recentEmployees,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({
      where: { employmentStatus: EmploymentStatus.ACTIVE },
    }),
    prisma.leaveRequest.count({
      where: { status: LeaveRequestStatus.PENDING },
    }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: todayDate },
        endDate: { gte: todayDate },
      },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { attendanceDate: todayDate },
      _count: { status: true },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: {
            employees: {
              where: { employmentStatus: EmploymentStatus.ACTIVE },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { employmentStatus: EmploymentStatus.ACTIVE },
      take: recentLimit,
      orderBy: [{ joiningDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        workEmail: true,
        joiningDate: true,
        department: { select: { id: true, name: true } },
        jobPosition: { select: { id: true, title: true } },
      },
    }),
  ])

  // Map today's attendance breakdown
  const attendanceToday: {
    PRESENT: number
    LATE: number
    ABSENT: number
    HALF_DAY: number
    ON_LEAVE: number
    totalMarked: number
    [key: string]: number
  } = {
    PRESENT: 0,
    LATE: 0,
    ABSENT: 0,
    HALF_DAY: 0,
    ON_LEAVE: 0,
    totalMarked: 0,
  }

  for (const group of attendanceGroups) {
    attendanceToday[group.status] = group._count.status
    attendanceToday.totalMarked += group._count.status
  }

  // Combine attendance on_leave with active approved leave requests
  const employeesOnLeave = Math.max(attendanceToday.ON_LEAVE || 0, onLeaveCount)

  // Map department counts
  const departmentCounts = departments.map((d) => ({
    departmentId: d.id,
    code: d.code,
    name: d.name,
    activeEmployeeCount: d._count.employees,
  }))

  return {
    totalEmployees,
    activeEmployees,
    employeesOnLeave,
    attendanceToday,
    pendingLeaveRequests,
    departmentCounts,
    recentEmployees,
  }
}

// -------------------------------------------------------------
// PAYROLL DASHBOARD SUMMARY (RESTRICTED TO PAYROLL ROLES & ADMIN)
// -------------------------------------------------------------
export async function getPayrollDashboardSummary(warningLimit = 10) {
  const [
    latestPayrun,
    payrunGroups,
    validatedTotals,
    payslipGroups,
    recentWarnings,
  ] = await Promise.all([
    prisma.payrun.findFirst({
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        employeeCount: true,
        totalGross: true,
        totalDeductions: true,
        totalNet: true,
        calculatedAt: true,
        validatedAt: true,
        createdAt: true,
      },
    }),
    prisma.payrun.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.payrun.aggregate({
      where: { status: PayrunStatus.VALIDATED },
      _sum: {
        totalGross: true,
        totalDeductions: true,
        totalNet: true,
      },
    }),
    prisma.payslip.groupBy({
      by: ["paymentStatus"],
      _count: { paymentStatus: true },
    }),
    prisma.payrunEmployee.findMany({
      where: { warningCount: { gt: 0 } },
      take: warningLimit,
      orderBy: { calculatedAt: "desc" },
      select: {
        id: true,
        payrunId: true,
        warningCount: true,
        warnings: true,
        calculatedAt: true,
        payrun: { select: { code: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ])

  // Map payrun status counts
  const payrunStatusCounts: {
    DRAFT: number
    CALCULATED: number
    VALIDATED: number
    CANCELLED: number
    total: number
    [key: string]: number
  } = {
    DRAFT: 0,
    CALCULATED: 0,
    VALIDATED: 0,
    CANCELLED: 0,
    total: 0,
  }

  for (const group of payrunGroups) {
    payrunStatusCounts[group.status] = group._count.status
    payrunStatusCounts.total += group._count.status
  }

  // Map payslip payment status counts
  const paymentStatusCounts: {
    UNPAID: number
    PROCESSING: number
    PAID: number
    FAILED: number
    total: number
    [key: string]: number
  } = {
    UNPAID: 0,
    PROCESSING: 0,
    PAID: 0,
    FAILED: 0,
    total: 0,
  }

  for (const group of payslipGroups) {
    paymentStatusCounts[group.paymentStatus] = group._count.paymentStatus
    paymentStatusCounts.total += group._count.paymentStatus
  }

  return {
    latestPayrun,
    payrunStatusCounts,
    grossPayroll: validatedTotals._sum.totalGross?.toString() || "0.00",
    totalDeductions: validatedTotals._sum.totalDeductions?.toString() || "0.00",
    netPayroll: validatedTotals._sum.totalNet?.toString() || "0.00",
    unpaidPayslipsCount: paymentStatusCounts.UNPAID || 0,
    payslipPaymentStatusCounts: paymentStatusCounts,
    recentPayrollWarnings: recentWarnings,
  }
}

// -------------------------------------------------------------
// EMPLOYEE SELF-SERVICE DASHBOARD SUMMARY
// -------------------------------------------------------------
export async function getEmployeeDashboardSummary(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      workEmail: true,
      joiningDate: true,
      department: { select: { id: true, name: true } },
      jobPosition: { select: { id: true, title: true } },
    },
  })

  if (!employee) {
    throw new DashboardError(
      404,
      "USER_NOT_LINKED_TO_EMPLOYEE",
      "No employee profile is linked to this user account",
    )
  }

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const todayDate = getTodayUtcDate()

  const [
    monthlyAttendanceGroups,
    todayAttendance,
    allocations,
    leaveRequestGroups,
    recentLeaveRequests,
    latestPayslip,
  ] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        employeeId: employee.id,
        attendanceDate: { gte: startOfMonth },
      },
      _count: { status: true },
    }),
    prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        attendanceDate: todayDate,
      },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        workedMinutes: true,
        status: true,
        source: true,
      },
    }),
    prisma.leaveAllocation.findMany({
      where: {
        employeeId: employee.id,
        year: currentYear,
      },
      select: {
        id: true,
        year: true,
        allocatedDays: true,
        usedDays: true,
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
            isPaid: true,
          },
        },
      },
    }),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: {
        employeeId: employee.id,
        startDate: {
          gte: new Date(Date.UTC(currentYear, 0, 1)),
        },
      },
      _count: { status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      take: 5,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        startDate: true,
        endDate: true,
        requestedDays: true,
        status: true,
        reason: true,
        leaveType: { select: { code: true, name: true } },
        createdAt: true,
      },
    }),
    prisma.payslip.findFirst({
      where: { employeeId: employee.id },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        payslipNumber: true,
        periodStart: true,
        periodEnd: true,
        baseSalary: true,
        grossAmount: true,
        totalDeductions: true,
        netAmount: true,
        status: true,
        paymentStatus: true,
        generatedAt: true,
        payrun: { select: { code: true } },
      },
    }),
  ])

  // Map monthly attendance
  const monthlyAttendance: Record<string, number> = {
    PRESENT: 0,
    LATE: 0,
    ABSENT: 0,
    HALF_DAY: 0,
    ON_LEAVE: 0,
  }

  for (const group of monthlyAttendanceGroups) {
    monthlyAttendance[group.status] = group._count.status
  }

  // Map leave balances
  const leaveBalances = allocations.map((a) => {
    const allocated = parseFloat(a.allocatedDays.toString())
    const used = parseFloat(a.usedDays.toString())
    return {
      leaveTypeId: a.leaveType.id,
      code: a.leaveType.code,
      name: a.leaveType.name,
      isPaid: a.leaveType.isPaid,
      allocatedDays: allocated,
      usedDays: used,
      remainingDays: Math.max(0, allocated - used),
    }
  })

  // Map leave request status counts
  const leaveStatusCounts: Record<string, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  }

  for (const group of leaveRequestGroups) {
    leaveStatusCounts[group.status] = group._count.status
  }

  return {
    profile: employee,
    attendanceSummary: {
      today: todayAttendance,
      currentMonth: monthlyAttendance,
    },
    leaveSummary: {
      balances: leaveBalances,
      statusCounts: leaveStatusCounts,
      recentRequests: recentLeaveRequests,
    },
    latestPayslip,
  }
}

// -------------------------------------------------------------
// UNIFIED ROLE-AWARE DASHBOARD DISPATCHER
// -------------------------------------------------------------
export async function getRoleAwareDashboard(auth: {
  userId: string
  role: UserRole
}) {
  switch (auth.role) {
    case UserRole.ADMIN: {
      const [hr, payroll] = await Promise.all([
        getHrDashboardSummary(),
        getPayrollDashboardSummary(),
      ])
      return {
        role: auth.role,
        hr,
        payroll,
      }
    }

    case UserRole.HR_MANAGER: {
      const hr = await getHrDashboardSummary()
      return {
        role: auth.role,
        hr,
      }
    }

    case UserRole.PAYROLL_MANAGER:
    case UserRole.PAYROLL_USER: {
      const payroll = await getPayrollDashboardSummary()
      return {
        role: auth.role,
        payroll,
      }
    }

    case UserRole.EMPLOYEE:
    default: {
      const me = await getEmployeeDashboardSummary(auth.userId)
      return {
        role: auth.role,
        me,
      }
    }
  }
}
