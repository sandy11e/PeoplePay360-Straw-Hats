import {
  ContractStatus,
  EmploymentStatus,
  PayrunStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"

export class PayrollError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "PayrollError"
  }
}

export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// -------------------------------------------------------------
// PURE DETERMINISTIC CALCULATION ENGINE
// -------------------------------------------------------------

export interface PayrollRuleInput {
  id?: string | undefined
  code: string
  name: string
  category: SalaryRuleCategory
  calculationType: SalaryRuleCalculationType
  amount: Prisma.Decimal | number | string | null
  percentage: Prisma.Decimal | number | string | null
  base: SalaryRuleBase | null
  sequence: number
  isTaxable?: boolean | undefined
  isActive?: boolean | undefined
}

export interface PayrollLineItem {
  ruleId?: string | undefined
  code: string
  name: string
  category: SalaryRuleCategory
  calculationType: SalaryRuleCalculationType
  baseAmount: string
  rateOrPercentage: string
  amount: string
  sequence: number
  isTaxable: boolean
}

export interface CalculatedEmployeePayroll {
  baseSalary: Prisma.Decimal
  grossAmount: Prisma.Decimal
  deductionAmount: Prisma.Decimal
  netAmount: Prisma.Decimal
  lineItems: PayrollLineItem[]
  warnings: string[]
  warningCount: number
}

// Deterministic calculation: Decimal-safe, zero floating-point math, zero eval
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

  // Filter active rules and sort by sequence ascending
  const sortedRules = [...rules]
    .filter((r) => r.isActive !== false)
    .sort((a, b) => a.sequence - b.sequence)

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

    const item: PayrollLineItem = {
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
    }

    lineItems.push(item)

    if (rule.category === SalaryRuleCategory.EARNING) {
      grossEarnings = grossEarnings.plus(computedAmount)
    } else if (rule.category === SalaryRuleCategory.DEDUCTION) {
      totalDeductions = totalDeductions.plus(computedAmount)
    }
  }

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

// -------------------------------------------------------------
// PAYRUN DATABASE SERVICES
// -------------------------------------------------------------

export interface CreatePayrunParams {
  code: string
  periodStart: string
  periodEnd: string
  createdByUserId: string
}

export async function createPayrun(params: CreatePayrunParams) {
  const { code, periodStart, periodEnd, createdByUserId } = params
  const startDate = parseDateOnly(periodStart)
  const endDate = parseDateOnly(periodEnd)

  if (endDate < startDate) {
    throw new PayrollError(400, "INVALID_PERIOD_DATES", "periodEnd cannot precede periodStart")
  }

  // 1. Check unique code
  const existingCode = await prisma.payrun.findUnique({
    where: { code },
  })

  if (existingCode) {
    throw new PayrollError(
      409,
      "PAYRUN_CODE_EXISTS",
      `A payrun with code '${code}' already exists.`,
    )
  }

  // 2. Prevent duplicate active payrun for the exact same payroll period
  const existingPeriod = await prisma.payrun.findFirst({
    where: {
      status: { not: PayrunStatus.CANCELLED },
      periodStart: startDate,
      periodEnd: endDate,
    },
  })

  if (existingPeriod) {
    throw new PayrollError(
      409,
      "PAYRUN_PERIOD_CONFLICT",
      `An active payrun (${existingPeriod.code}) already exists for period ${periodStart} to ${periodEnd}.`,
    )
  }

  return prisma.payrun.create({
    data: {
      code,
      periodStart: startDate,
      periodEnd: endDate,
      status: PayrunStatus.DRAFT,
      createdByUserId,
    },
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
    },
  })
}

export async function calculatePayrun(payrunId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
  })

  if (!payrun) {
    throw new PayrollError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  if (payrun.status === PayrunStatus.VALIDATED) {
    throw new PayrollError(
      409,
      "PAYRUN_ALREADY_VALIDATED",
      "Validated payruns are immutable and cannot be recalculated.",
    )
  }

  if (payrun.status === PayrunStatus.CANCELLED) {
    throw new PayrollError(
      409,
      "PAYRUN_CANCELLED",
      "Cancelled payruns cannot be calculated.",
    )
  }

  // Find all ACTIVE employees
  const activeEmployees = await prisma.employee.findMany({
    where: {
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
    },
    orderBy: { employeeCode: "asc" },
  })

  return prisma.$transaction(async (tx) => {
    // Clear any previous calculation records for this payrun (allows repeatable calculation)
    await tx.payrunEmployee.deleteMany({
      where: { payrunId },
    })

    let payrunGross = new Prisma.Decimal(0)
    let payrunDeductions = new Prisma.Decimal(0)
    let payrunNet = new Prisma.Decimal(0)

    for (const emp of activeEmployees) {
      const warnings: string[] = []

      // 1. Fetch active contract for period
      const contract = await tx.employeeContract.findFirst({
        where: {
          employeeId: emp.id,
          status: ContractStatus.ACTIVE,
          startDate: { lte: payrun.periodEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: payrun.periodStart } },
          ],
        },
        orderBy: { startDate: "desc" },
      })

      if (!contract) {
        warnings.push("MISSING_ACTIVE_CONTRACT: No active employment contract found for this period.")
      }

      // 2. Fetch salary structure assignment for period
      const structureAssignment = await tx.employeeSalaryStructureAssignment.findFirst({
        where: {
          employeeId: emp.id,
          effectiveFrom: { lte: payrun.periodEnd },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: payrun.periodStart } },
          ],
        },
        include: {
          structure: {
            include: {
              rules: {
                where: { isActive: true },
                orderBy: { sequence: "asc" },
              },
            },
          },
        },
        orderBy: { effectiveFrom: "desc" },
      })

      if (!structureAssignment || !structureAssignment.structure) {
        warnings.push("MISSING_SALARY_STRUCTURE: No salary structure assigned for this period.")
      }

      // 3. Compute payroll for employee
      let calcResult: CalculatedEmployeePayroll

      if (!contract || !structureAssignment?.structure) {
        // Safe fallback without silent corruption: record warnings, zero amounts
        calcResult = {
          baseSalary: new Prisma.Decimal(0),
          grossAmount: new Prisma.Decimal(0),
          deductionAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(0),
          lineItems: [],
          warnings,
          warningCount: warnings.length,
        }
      } else {
        const rules = structureAssignment.structure.rules.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          category: r.category,
          calculationType: r.calculationType,
          amount: r.amount,
          percentage: r.percentage,
          base: r.base,
          sequence: r.sequence,
          isTaxable: r.isTaxable,
          isActive: r.isActive,
        }))

        calcResult = calculateEmployeePayroll(contract.baseSalary, rules, warnings)
      }

      // 4. Create snapshot payloads
      const contractSnapshot = contract
        ? {
            id: contract.id,
            contractNumber: contract.contractNumber,
            baseSalary: contract.baseSalary.toString(),
            currency: contract.currency,
            startDate: formatDateOnly(contract.startDate),
            endDate: contract.endDate ? formatDateOnly(contract.endDate) : null,
          }
        : null

      const salaryStructureSnapshot = structureAssignment?.structure
        ? {
            id: structureAssignment.structure.id,
            code: structureAssignment.structure.code,
            name: structureAssignment.structure.name,
            rules: structureAssignment.structure.rules.map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              category: r.category,
              calculationType: r.calculationType,
              amount: r.amount?.toString() ?? null,
              percentage: r.percentage?.toString() ?? null,
              base: r.base,
              sequence: r.sequence,
              isTaxable: r.isTaxable,
            })),
          }
        : null

      // 5. Persist calculation item with snapshots
      await tx.payrunEmployee.create({
        data: {
          payrunId,
          employeeId: emp.id,
          contractId: contract?.id ?? null,
          contractSnapshot: contractSnapshot as any,
          salaryStructureId: structureAssignment?.structureId ?? null,
          salaryStructureSnapshot: salaryStructureSnapshot as any,
          baseSalary: calcResult.baseSalary,
          grossAmount: calcResult.grossAmount,
          deductionAmount: calcResult.deductionAmount,
          netAmount: calcResult.netAmount,
          lineItems: calcResult.lineItems as any,
          warnings: calcResult.warnings as any,
          warningCount: calcResult.warningCount,
          calculatedAt: new Date(),
        },
      })

      payrunGross = payrunGross.plus(calcResult.grossAmount)
      payrunDeductions = payrunDeductions.plus(calcResult.deductionAmount)
      payrunNet = payrunNet.plus(calcResult.netAmount)
    }

    // 6. Update Payrun totals and status
    return tx.payrun.update({
      where: { id: payrunId },
      data: {
        status: PayrunStatus.CALCULATED,
        calculatedAt: new Date(),
        totalGross: payrunGross,
        totalDeductions: payrunDeductions,
        totalNet: payrunNet,
        employeeCount: activeEmployees.length,
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: { items: true },
        },
      },
    })
  })
}

export async function validatePayrun(payrunId: string, validatedByUserId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
  })

  if (!payrun) {
    throw new PayrollError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  if (payrun.status === PayrunStatus.VALIDATED) {
    throw new PayrollError(
      409,
      "PAYRUN_ALREADY_VALIDATED",
      "Payrun is already validated.",
    )
  }

  if (payrun.status === PayrunStatus.DRAFT) {
    throw new PayrollError(
      400,
      "PAYRUN_NOT_CALCULATED",
      "Payrun must be in CALCULATED status before it can be validated.",
    )
  }

  if (payrun.status === PayrunStatus.CANCELLED) {
    throw new PayrollError(
      409,
      "PAYRUN_CANCELLED",
      "Cannot validate a cancelled payrun.",
    )
  }

  return prisma.payrun.update({
    where: { id: payrunId },
    data: {
      status: PayrunStatus.VALIDATED,
      validatedAt: new Date(),
      validatedByUserId,
    },
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
      validatedByUser: {
        select: { id: true, email: true, role: true },
      },
      _count: {
        select: { items: true },
      },
    },
  })
}

export async function cancelPayrun(payrunId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
  })

  if (!payrun) {
    throw new PayrollError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  if (payrun.status === PayrunStatus.VALIDATED) {
    throw new PayrollError(
      409,
      "PAYRUN_ALREADY_VALIDATED",
      "Validated payruns are immutable and cannot be cancelled.",
    )
  }

  if (payrun.status === PayrunStatus.CANCELLED) {
    throw new PayrollError(
      409,
      "PAYRUN_ALREADY_CANCELLED",
      "Payrun is already cancelled.",
    )
  }

  return prisma.payrun.update({
    where: { id: payrunId },
    data: {
      status: PayrunStatus.CANCELLED,
    },
  })
}

export async function getPayrunById(payrunId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
      validatedByUser: {
        select: { id: true, email: true, role: true },
      },
      _count: {
        select: { items: true },
      },
    },
  })

  if (!payrun) {
    throw new PayrollError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  return payrun
}

export interface ListPayrunsFilterParams {
  status?: PayrunStatus | undefined
  from?: string | undefined
  to?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export async function listPayruns(filter: ListPayrunsFilterParams) {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (filter.status) {
    where.status = filter.status
  }
  if (filter.from || filter.to) {
    where.periodStart = {}
    if (filter.from) {
      where.periodStart.gte = parseDateOnly(filter.from)
    }
    if (filter.to) {
      where.periodStart.lte = parseDateOnly(filter.to)
    }
  }

  const [payruns, total] = await Promise.all([
    prisma.payrun.findMany({
      where,
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        createdByUser: {
          select: { id: true, email: true, role: true },
        },
        validatedByUser: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.payrun.count({ where }),
  ])

  return {
    payruns,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getPayrunEmployees(payrunId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
  })

  if (!payrun) {
    throw new PayrollError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  const items = await prisma.payrunEmployee.findMany({
    where: { payrunId },
    orderBy: { employee: { employeeCode: "asc" } },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          department: {
            select: { id: true, name: true },
          },
          jobPosition: {
            select: { id: true, title: true },
          },
        },
      },
    },
  })

  return {
    payrunId,
    payrunCode: payrun.code,
    status: payrun.status,
    totalGross: payrun.totalGross,
    totalDeductions: payrun.totalDeductions,
    totalNet: payrun.totalNet,
    items,
  }
}
