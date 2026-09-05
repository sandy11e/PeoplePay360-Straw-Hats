import {
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"

export class SalaryStructureError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "SalaryStructureError"
  }
}

export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// -------------------------------------------------------------
// SALARY STRUCTURE SERVICES
// -------------------------------------------------------------

export interface CreateSalaryStructureParams {
  code: string
  name: string
  description?: string | null | undefined
  isActive?: boolean | undefined
}

export async function createSalaryStructure(params: CreateSalaryStructureParams) {
  const existing = await prisma.salaryStructure.findUnique({
    where: { code: params.code },
  })

  if (existing) {
    throw new SalaryStructureError(
      409,
      "STRUCTURE_CODE_EXISTS",
      `A salary structure with code '${params.code}' already exists.`,
    )
  }

  return prisma.salaryStructure.create({
    data: {
      code: params.code,
      name: params.name,
      description: params.description ?? null,
      isActive: params.isActive ?? true,
    },
  })
}

export interface ListSalaryStructuresFilterParams {
  isActive?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export async function listSalaryStructures(filter: ListSalaryStructuresFilterParams) {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (filter.isActive !== undefined) {
    where.isActive = filter.isActive === "true"
  }

  const [structures, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      where,
      orderBy: { code: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            rules: true,
            assignments: true,
          },
        },
      },
    }),
    prisma.salaryStructure.count({ where }),
  ])

  return {
    salaryStructures: structures,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getSalaryStructureById(id: string) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: {
        orderBy: { sequence: "asc" },
      },
      _count: {
        select: {
          assignments: true,
        },
      },
    },
  })

  if (!structure) {
    throw new SalaryStructureError(404, "STRUCTURE_NOT_FOUND", "Salary structure not found")
  }

  return structure
}

export interface UpdateSalaryStructureParams {
  id: string
  code?: string | undefined
  name?: string | undefined
  description?: string | null | undefined
  isActive?: boolean | undefined
}

export async function updateSalaryStructure(params: UpdateSalaryStructureParams) {
  const { id, ...data } = params

  const existing = await prisma.salaryStructure.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new SalaryStructureError(404, "STRUCTURE_NOT_FOUND", "Salary structure not found")
  }

  if (data.code && data.code !== existing.code) {
    const codeConflict = await prisma.salaryStructure.findUnique({
      where: { code: data.code },
    })

    if (codeConflict) {
      throw new SalaryStructureError(
        409,
        "STRUCTURE_CODE_EXISTS",
        `A salary structure with code '${data.code}' already exists.`,
      )
    }
  }

  const updateData: Record<string, any> = {}
  if (data.code !== undefined) updateData.code = data.code
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  return prisma.salaryStructure.update({
    where: { id },
    data: updateData,
    include: {
      rules: {
        orderBy: { sequence: "asc" },
      },
    },
  })
}

// -------------------------------------------------------------
// SALARY RULE SERVICES
// -------------------------------------------------------------

export interface CreateSalaryRuleParams {
  structureId: string
  code: string
  name: string
  category: SalaryRuleCategory
  calculationType: SalaryRuleCalculationType
  amount?: number | string | null | undefined
  percentage?: number | string | null | undefined
  base?: SalaryRuleBase | null | undefined
  sequence: number
  isTaxable?: boolean | undefined
  isActive?: boolean | undefined
}

export async function createSalaryRule(params: CreateSalaryRuleParams) {
  const { structureId, code, name, category, calculationType, sequence } = params

  // 1. Verify structure exists
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: structureId },
  })

  if (!structure) {
    throw new SalaryStructureError(404, "STRUCTURE_NOT_FOUND", "Salary structure not found")
  }

  // 2. Verify rule code unique in structure
  const existingRule = await prisma.salaryRule.findUnique({
    where: {
      structureId_code: {
        structureId,
        code,
      },
    },
  })

  if (existingRule) {
    throw new SalaryStructureError(
      409,
      "RULE_CODE_EXISTS_IN_STRUCTURE",
      `Rule with code '${code}' already exists in this salary structure.`,
    )
  }

  const amountDecimal =
    calculationType === SalaryRuleCalculationType.FIXED && params.amount !== undefined && params.amount !== null
      ? new Prisma.Decimal(params.amount)
      : null

  const percentageDecimal =
    calculationType === SalaryRuleCalculationType.PERCENTAGE && params.percentage !== undefined && params.percentage !== null
      ? new Prisma.Decimal(params.percentage)
      : null

  const base = calculationType === SalaryRuleCalculationType.PERCENTAGE ? params.base ?? null : null

  return prisma.salaryRule.create({
    data: {
      structureId,
      code,
      name,
      category,
      calculationType,
      amount: amountDecimal,
      percentage: percentageDecimal,
      base,
      sequence,
      isTaxable: params.isTaxable ?? true,
      isActive: params.isActive ?? true,
    },
  })
}

export interface UpdateSalaryRuleParams {
  id: string
  name?: string | undefined
  category?: SalaryRuleCategory | undefined
  calculationType?: SalaryRuleCalculationType | undefined
  amount?: number | string | null | undefined
  percentage?: number | string | null | undefined
  base?: SalaryRuleBase | null | undefined
  sequence?: number | undefined
  isTaxable?: boolean | undefined
  isActive?: boolean | undefined
}

export async function updateSalaryRule(params: UpdateSalaryRuleParams) {
  const { id, ...data } = params

  const existing = await prisma.salaryRule.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new SalaryStructureError(404, "RULE_NOT_FOUND", "Salary rule not found")
  }

  const targetCalcType = data.calculationType ?? existing.calculationType

  const updateData: Record<string, any> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.category !== undefined) updateData.category = data.category
  if (data.calculationType !== undefined) updateData.calculationType = data.calculationType
  if (data.sequence !== undefined) updateData.sequence = data.sequence
  if (data.isTaxable !== undefined) updateData.isTaxable = data.isTaxable
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  if (targetCalcType === SalaryRuleCalculationType.FIXED) {
    if (data.amount !== undefined) {
      updateData.amount = data.amount !== null ? new Prisma.Decimal(data.amount) : null
    }
    updateData.percentage = null
    updateData.base = null
  } else if (targetCalcType === SalaryRuleCalculationType.PERCENTAGE) {
    if (data.percentage !== undefined) {
      updateData.percentage = data.percentage !== null ? new Prisma.Decimal(data.percentage) : null
    }
    if (data.base !== undefined) {
      updateData.base = data.base
    }
    updateData.amount = null
  }

  return prisma.salaryRule.update({
    where: { id },
    data: updateData,
  })
}

// -------------------------------------------------------------
// EMPLOYEE SALARY STRUCTURE ASSIGNMENT SERVICES
// -------------------------------------------------------------

export interface AssignSalaryStructureParams {
  employeeId: string
  structureId: string
  effectiveFrom: string
  effectiveTo?: string | null | undefined
  closePrevious?: boolean | undefined
}

export async function assignSalaryStructureToEmployee(params: AssignSalaryStructureParams) {
  const { employeeId, structureId, effectiveFrom, effectiveTo, closePrevious = false } = params
  const effectiveFromDate = parseDateOnly(effectiveFrom)
  const effectiveToDate = effectiveTo ? parseDateOnly(effectiveTo) : null

  // 1. Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true },
  })

  if (!employee) {
    throw new SalaryStructureError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  // 2. Verify structure exists and is active
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: structureId },
  })

  if (!structure) {
    throw new SalaryStructureError(404, "STRUCTURE_NOT_FOUND", "Salary structure not found")
  }

  if (!structure.isActive) {
    throw new SalaryStructureError(
      400,
      "STRUCTURE_INACTIVE",
      "Cannot assign an inactive salary structure.",
    )
  }

  // 3. Overlap detection and assignment transaction
  return prisma.$transaction(async (tx) => {
    let previousToCloseId: string | null = null
    let previousEffectiveToDate: Date | null = null
    let previousToDeleteId: string | null = null

    if (closePrevious) {
      const openAssignment = await tx.employeeSalaryStructureAssignment.findFirst({
        where: {
          employeeId,
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: "desc" },
      })

      if (openAssignment) {
        if (openAssignment.effectiveFrom < effectiveFromDate) {
          previousToCloseId = openAssignment.id
          previousEffectiveToDate = new Date(effectiveFromDate.getTime() - 24 * 60 * 60 * 1000)
        } else {
          // If the existing open assignment started on or after effectiveFromDate (e.g. same day),
          // it is superseded by the new assignment.
          previousToDeleteId = openAssignment.id
        }
      }
    }

    // Excluded IDs from conflict check
    const excludedIds = [previousToCloseId, previousToDeleteId].filter((id): id is string => Boolean(id))

    // Check for any overlapping assignment for this employee
    const conflictingAssignment = await tx.employeeSalaryStructureAssignment.findFirst({
      where: {
        employeeId,
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
        AND: [
          ...(effectiveToDate ? [{ effectiveFrom: { lte: effectiveToDate } }] : []),
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveFromDate } },
            ],
          },
        ],
      },
      include: {
        structure: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    if (conflictingAssignment) {
      throw new SalaryStructureError(
        409,
        "SALARY_STRUCTURE_ASSIGNMENT_OVERLAP",
        `Employee already has an active salary structure assignment during this period (${conflictingAssignment.structure.name} [${conflictingAssignment.structure.code}] from ${formatDateOnly(conflictingAssignment.effectiveFrom)} to ${conflictingAssignment.effectiveTo ? formatDateOnly(conflictingAssignment.effectiveTo) : "ongoing"}).`,
      )
    }

    if (previousToDeleteId) {
      await tx.employeeSalaryStructureAssignment.delete({
        where: { id: previousToDeleteId },
      })
    }

    if (previousToCloseId && previousEffectiveToDate) {
      await tx.employeeSalaryStructureAssignment.update({
        where: { id: previousToCloseId },
        data: { effectiveTo: previousEffectiveToDate },
      })
    }

    return tx.employeeSalaryStructureAssignment.create({
      data: {
        employeeId,
        structureId,
        effectiveFrom: effectiveFromDate,
        effectiveTo: effectiveToDate,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
          },
        },
        structure: {
          include: {
            rules: {
              where: { isActive: true },
              orderBy: { sequence: "asc" },
            },
          },
        },
      },
    })
  })
}

export async function getEmployeeSalaryStructureAssignments(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  })

  if (!employee) {
    throw new SalaryStructureError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  const assignments = await prisma.employeeSalaryStructureAssignment.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: "desc" },
    include: {
      structure: {
        include: {
          rules: {
            orderBy: { sequence: "asc" },
          },
        },
      },
    },
  })

  return {
    employeeId,
    assignments,
  }
}

// -------------------------------------------------------------
// DETERMINISTIC SALARY RULE EVALUATION ENGINE (NO EVAL, DECIMAL MATH)
// -------------------------------------------------------------

export interface RuleCalculationResult {
  ruleId: string
  code: string
  name: string
  category: SalaryRuleCategory
  calculationType: SalaryRuleCalculationType
  base: SalaryRuleBase | null
  baseAmount: Prisma.Decimal
  rateOrPercentage: Prisma.Decimal
  computedAmount: Prisma.Decimal
  sequence: number
  isTaxable: boolean
}

export interface SalaryBreakdownResult {
  baseSalary: Prisma.Decimal
  grossEarnings: Prisma.Decimal
  totalDeductions: Prisma.Decimal
  netSalary: Prisma.Decimal
  earnings: RuleCalculationResult[]
  deductions: RuleCalculationResult[]
}

export function calculateSalaryBreakdown(
  baseSalary: number | string | Prisma.Decimal,
  rules: {
    id: string
    code: string
    name: string
    category: SalaryRuleCategory
    calculationType: SalaryRuleCalculationType
    amount: Prisma.Decimal | null
    percentage: Prisma.Decimal | null
    base: SalaryRuleBase | null
    sequence: number
    isTaxable: boolean
    isActive: boolean
  }[],
): SalaryBreakdownResult {
  const baseSalaryDecimal = new Prisma.Decimal(baseSalary)
  let grossEarnings = new Prisma.Decimal(baseSalaryDecimal)
  let totalDeductions = new Prisma.Decimal(0)

  const earnings: RuleCalculationResult[] = []
  const deductions: RuleCalculationResult[] = []

  // Active rules sorted deterministically by sequence
  const sortedRules = [...rules]
    .filter((r) => r.isActive)
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
      computedAmount = baseAmount.times(rateOrPercentage).dividedBy(100)
    }

    const item: RuleCalculationResult = {
      ruleId: rule.id,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      calculationType: rule.calculationType,
      base: rule.base,
      baseAmount,
      rateOrPercentage,
      computedAmount,
      sequence: rule.sequence,
      isTaxable: rule.isTaxable,
    }

    if (rule.category === SalaryRuleCategory.EARNING) {
      earnings.push(item)
      grossEarnings = grossEarnings.plus(computedAmount)
    } else if (rule.category === SalaryRuleCategory.DEDUCTION) {
      deductions.push(item)
      totalDeductions = totalDeductions.plus(computedAmount)
    }
  }

  const netSalary = grossEarnings.minus(totalDeductions)

  return {
    baseSalary: baseSalaryDecimal,
    grossEarnings,
    totalDeductions,
    netSalary,
    earnings,
    deductions,
  }
}
