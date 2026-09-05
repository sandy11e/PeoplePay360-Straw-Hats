import {
  PayrunStatus,
  PaymentStatus,
  PayslipStatus,
  SalaryRuleCategory,
  UserRole,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { PAYROLL_READ_ACCESS } from "../../auth/auth.roles.js"
import type {
  GeneratePayslipsInput,
  ListMyPayslipsQuery,
  ListPayrunPayslipsQuery,
  UpdatePaymentStatusInput,
} from "./payslip.schema.js"

export class PayslipError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "PayslipError"
  }
}

interface StoredPayrollLineItem {
  ruleId?: string
  code: string
  name: string
  category: SalaryRuleCategory
  baseAmount: string
  rateOrPercentage: string
  amount: string
  sequence: number
  isTaxable: boolean
}

export async function generatePayslipsForPayrun(
  payrunId: string,
  input: GeneratePayslipsInput,
  _adminUserId: string,
) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              workEmail: true,
              departmentId: true,
              jobPositionId: true,
            },
          },
        },
      },
    },
  })

  if (!payrun) {
    throw new PayslipError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  if (payrun.status === PayrunStatus.DRAFT) {
    throw new PayslipError(
      400,
      "PAYRUN_NOT_CALCULATED",
      "Cannot generate payslips for a payrun in DRAFT status. Calculate the payrun first.",
    )
  }

  if (payrun.status === PayrunStatus.CANCELLED) {
    throw new PayslipError(
      400,
      "PAYRUN_CANCELLED",
      "Cannot generate payslips for a CANCELLED payrun.",
    )
  }

  if (payrun.items.length === 0) {
    throw new PayslipError(
      400,
      "PAYRUN_EMPTY",
      "Payrun has no employee calculation records.",
    )
  }

  // Check for existing payslips
  const existingPayslips = await prisma.payslip.findMany({
    where: { payrunId },
    select: {
      id: true,
      status: true,
      employeeId: true,
    },
  })

  if (existingPayslips.length > 0) {
    const hasFinal = existingPayslips.some((p) => p.status === PayslipStatus.FINAL)
    if (hasFinal) {
      throw new PayslipError(
        409,
        "PAYSLIPS_ALREADY_FINALIZED",
        "Payslips for this payrun have already been generated and finalized. Finalized payslips are immutable.",
      )
    }

    if (!input.overwriteDrafts) {
      throw new PayslipError(
        409,
        "PAYSLIPS_ALREADY_GENERATED",
        "Payslips for this payrun have already been generated. Set overwriteDrafts: true to regenerate draft payslips.",
      )
    }
  }

  // Determine target status: explicit input > VALIDATED payrun -> FINAL > default DRAFT
  const targetStatus: PayslipStatus =
    input.status ??
    (payrun.status === PayrunStatus.VALIDATED
      ? PayslipStatus.FINAL
      : PayslipStatus.DRAFT)

  // Generate payslips inside a database transaction
  const createdPayslips = await prisma.$transaction(async (tx) => {
    if (existingPayslips.length > 0 && input.overwriteDrafts) {
      // Remove lines first, then payslips
      await tx.payslipLine.deleteMany({
        where: {
          payslip: {
            payrunId,
          },
        },
      })
      await tx.payslip.deleteMany({
        where: { payrunId },
      })
    }

    const created = []

    for (const item of payrun.items) {
      const payslipNumber = `PS-${payrun.code}-${item.employee.employeeCode}`

      // Extract line items from PayrunEmployee JSON snapshot
      const rawLineItems = (item.lineItems as unknown as StoredPayrollLineItem[]) || []

      const linesData = rawLineItems.map((li) => ({
        salaryRuleCode: li.code,
        salaryRuleName: li.name,
        category: li.category,
        amount: new Prisma.Decimal(li.amount),
        sequence: li.sequence,
      }))

      const payslip = await tx.payslip.create({
        data: {
          payslipNumber,
          payrunId: payrun.id,
          employeeId: item.employeeId,
          periodStart: payrun.periodStart,
          periodEnd: payrun.periodEnd,
          baseSalary: item.baseSalary,
          grossAmount: item.grossAmount,
          totalDeductions: item.deductionAmount,
          netAmount: item.netAmount,
          status: targetStatus,
          paymentStatus: PaymentStatus.UNPAID,
          lines: {
            create: linesData,
          },
        },
        include: {
          lines: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              workEmail: true,
            },
          },
        },
      })

      created.push(payslip)
    }

    return created
  })

  return {
    payrunId: payrun.id,
    payrunCode: payrun.code,
    status: targetStatus,
    count: createdPayslips.length,
    payslips: createdPayslips,
  }
}

export async function listPayslipsForPayrun(
  payrunId: string,
  query: ListPayrunPayslipsQuery,
) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    select: { id: true, code: true, status: true, periodStart: true, periodEnd: true },
  })

  if (!payrun) {
    throw new PayslipError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  const { page, limit, status, paymentStatus, search } = query
  const skip = (page - 1) * limit

  const whereClause: Prisma.PayslipWhereInput = {
    payrunId,
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
    ...(search && {
      employee: {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { employeeCode: { contains: search, mode: "insensitive" } },
          { workEmail: { contains: search, mode: "insensitive" } },
        ],
      },
    }),
  }

  const [total, data] = await Promise.all([
    prisma.payslip.count({ where: whereClause }),
    prisma.payslip.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: [{ employee: { employeeCode: "asc" } }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
            department: { select: { id: true, name: true } },
            jobPosition: { select: { id: true, title: true } },
          },
        },
        _count: {
          select: { lines: true },
        },
      },
    }),
  ])

  return {
    payrun,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

export async function getPayslipById(
  payslipId: string,
  requestingUser: { userId: string; role: UserRole },
) {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      lines: {
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      },
      employee: {
        select: {
          id: true,
          userId: true,
          employeeCode: true,
          firstName: true,
          middleName: true,
          lastName: true,
          workEmail: true,
          department: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, title: true } },
        },
      },
      payrun: {
        select: {
          id: true,
          code: true,
          status: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  })

  if (!payslip) {
    throw new PayslipError(404, "PAYSLIP_NOT_FOUND", "Payslip not found")
  }

  // Enforce role-based access & employee isolation
  const hasPayrollAccess = (PAYROLL_READ_ACCESS as readonly UserRole[]).includes(requestingUser.role)

  if (!hasPayrollAccess) {
    if (requestingUser.role === UserRole.EMPLOYEE) {
      if (payslip.employee.userId !== requestingUser.userId) {
        throw new PayslipError(
          403,
          "FORBIDDEN",
          "You are not authorized to view this payslip",
        )
      }
    } else {
      throw new PayslipError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      )
    }
  }

  return payslip
}

export async function listMyPayslips(
  userId: string,
  query: ListMyPayslipsQuery,
) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
    },
  })

  if (!employee) {
    throw new PayslipError(
      404,
      "USER_NOT_LINKED_TO_EMPLOYEE",
      "No employee profile is linked to this user account",
    )
  }

  const { page, limit, status } = query
  const skip = (page - 1) * limit

  const whereClause: Prisma.PayslipWhereInput = {
    employeeId: employee.id,
    ...(status && { status }),
  }

  const [total, data] = await Promise.all([
    prisma.payslip.count({ where: whereClause }),
    prisma.payslip.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      include: {
        payrun: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
        _count: {
          select: { lines: true },
        },
      },
    }),
  ])

  return {
    employee,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}

export async function getMyPayslipById(payslipId: string, userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, employeeCode: true },
  })

  if (!employee) {
    throw new PayslipError(
      404,
      "USER_NOT_LINKED_TO_EMPLOYEE",
      "No employee profile is linked to this user account",
    )
  }

  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      lines: {
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      },
      payrun: {
        select: {
          id: true,
          code: true,
          status: true,
          periodStart: true,
          periodEnd: true,
        },
      },
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          department: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!payslip) {
    throw new PayslipError(404, "PAYSLIP_NOT_FOUND", "Payslip not found")
  }

  if (payslip.employeeId !== employee.id) {
    throw new PayslipError(
      403,
      "FORBIDDEN",
      "You are not authorized to view another employee's payslip",
    )
  }

  return payslip
}

export async function updatePaymentStatus(
  payslipId: string,
  input: UpdatePaymentStatusInput,
  _adminUserId: string,
) {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
  })

  if (!payslip) {
    throw new PayslipError(404, "PAYSLIP_NOT_FOUND", "Payslip not found")
  }

  // Update only paymentStatus and optionally status (e.g. finalizing)
  // Financial amounts and line items are never touched here.
  const updated = await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      paymentStatus: input.paymentStatus,
      ...(input.status && { status: input.status }),
    },
    include: {
      lines: {
        orderBy: [{ sequence: "asc" }],
      },
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return updated
}
