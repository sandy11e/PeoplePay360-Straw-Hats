import { Router } from "express"

import { type AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  ADMIN_ONLY,
  HR_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { ContractStatus, UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { extractClientInfo, recordAuditLog } from "../audit/audit.service.js"

import {
  contractIdParamSchema,
  contractListQuerySchema,
  createContractSchema,
  employeeContractListQuerySchema,
  employeeIdParamSchema,
  updateContractSchema,
  updateContractStatusSchema,
} from "./contract.schema.js"

export const contractRouter = Router()

const contractSelect = {
  id: true,
  contractNumber: true,
  employeeId: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
    },
  },
  startDate: true,
  endDate: true,
  baseSalary: true,
  currency: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

const PAYROLL_ACCESS = [
  UserRole.ADMIN,
  UserRole.PAYROLL_MANAGER,
  UserRole.PAYROLL_USER,
  UserRole.HR_MANAGER,
]

// POST /api/v1/contracts
// Create a new contract (ADMIN / HR_MANAGER only)
contractRouter.post(
  "/",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const parsed = createContractSchema.safeParse(
      request.body,
    )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid contract data",
          fields: parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const {
      contractNumber,
      employeeId,
      startDate,
      endDate,
      baseSalary,
      currency,
      notes,
    } = parsed.data

    // Check if employee exists
    const employee = await prisma.employee.findUnique(
      {
        where: { id: employeeId },
      },
    )

    if (!employee) {
      response.status(404).json({
        error: {
          code: "EMPLOYEE_NOT_FOUND",
          message: "Employee not found",
        },
      })

      return
    }

    // Check if contract number already exists
    const existing =
      await prisma.employeeContract.findUnique({
        where: { contractNumber },
      })

    if (existing) {
      response.status(409).json({
        error: {
          code: "CONTRACT_NUMBER_EXISTS",
          message:
            "A contract with this number already exists",
        },
      })

      return
    }

    // Check for conflicting active contracts
    const conflictingContract =
      await prisma.employeeContract.findFirst({
        where: {
          employeeId,
          status: ContractStatus.ACTIVE,
          OR: [
            {
              // New contract overlaps existing active contract
              startDate: { lte: endDate ?? new Date("2099-12-31") },
              endDate: {
                gte: startDate,
              },
            },
          ],
        },
      })

    if (conflictingContract) {
      response.status(409).json({
        error: {
          code: "CONFLICTING_ACTIVE_CONTRACT",
          message:
            "Employee has an overlapping active contract",
        },
      })

      return
    }

    // Create contract
    const contract = await prisma.employeeContract.create(
      {
        data: {
          contractNumber,
          employeeId,
          startDate,
          endDate: endDate ?? null,
          baseSalary,
          currency,
          status: ContractStatus.DRAFT,
          notes: notes ?? null,
        },

        select: contractSelect,
      },
    )

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "CONTRACT_CREATED",
      entityType: "EmployeeContract",
      entityId: contract.id,
      metadata: {
        contractNumber: contract.contractNumber,
        employeeId: contract.employeeId,
        startDate: contract.startDate,
        status: contract.status,
      },
      ...clientInfo,
    })

    response.status(201).json({
      contract,
    })
  },
)

// GET /api/v1/contracts
// List contracts with filters (ADMIN / HR_MANAGER / PAYROLL_* only)
contractRouter.get(
  "/",
  requireAuth,
  requireRole(...PAYROLL_ACCESS),
  async (request, response) => {
    const parsed = contractListQuerySchema.safeParse(
      request.query,
    )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          fields: parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const {
      page,
      pageSize,
      employeeId,
      status,
    } = parsed.data

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (status) {
      where.status = status
    }

    const [contracts, total] = await Promise.all([
      prisma.employeeContract.findMany({
        where,
        select: contractSelect,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.employeeContract.count({ where }),
    ])

    response.status(200).json({
      contracts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },
)

// GET /api/v1/contracts/:id
// Get contract by ID (ADMIN / HR_MANAGER / PAYROLL_* only)
contractRouter.get(
  "/:id",
  requireAuth,
  requireRole(...PAYROLL_ACCESS),
  async (request, response) => {
    const parsed = contractIdParamSchema.safeParse(
      request.params,
    )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid contract ID",
          fields: parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = parsed.data

    const contract =
      await prisma.employeeContract.findUnique({
        where: { id },
        select: contractSelect,
      })

    if (!contract) {
      response.status(404).json({
        error: {
          code: "CONTRACT_NOT_FOUND",
          message: "Contract not found",
        },
      })

      return
    }

    response.status(200).json({
      contract,
    })
  },
)

// PATCH /api/v1/contracts/:id
// Update contract (ADMIN / HR_MANAGER only)
contractRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const paramsResult = contractIdParamSchema.safeParse(
      request.params,
    )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid contract ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult = updateContractSchema.safeParse(
      request.body,
    )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid contract data",
          fields: bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const updates = bodyResult.data

    // Check if contract exists
    const contract =
      await prisma.employeeContract.findUnique({
        where: { id },
        include: { employee: true },
      })

    if (!contract) {
      response.status(404).json({
        error: {
          code: "CONTRACT_NOT_FOUND",
          message: "Contract not found",
        },
      })

      return
    }

    // Don't allow updates to EXPIRED, TERMINATED, or CANCELLED contracts
    if (
      contract.status === ContractStatus.EXPIRED ||
      contract.status === ContractStatus.TERMINATED ||
      contract.status === ContractStatus.CANCELLED
    ) {
      response.status(409).json({
        error: {
          code: "CONTRACT_LOCKED",
          message:
            "Cannot update expired, terminated, or cancelled contracts",
        },
      })

      return
    }

    // Check for duplicate contract number if being updated
    if (
      updates.contractNumber &&
      updates.contractNumber !== contract.contractNumber
    ) {
      const existing =
        await prisma.employeeContract.findUnique({
          where: {
            contractNumber: updates.contractNumber,
          },
        })

      if (existing) {
        response.status(409).json({
          error: {
            code: "CONTRACT_NUMBER_EXISTS",
            message:
              "A contract with this number already exists",
          },
        })

        return
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (updates.contractNumber !== undefined) {
      updateData.contractNumber = updates.contractNumber
    }

    if (updates.startDate !== undefined) {
      updateData.startDate = updates.startDate
    }

    if (updates.endDate !== undefined) {
      updateData.endDate =
        updates.endDate === null ? null : updates.endDate
    }

    if (updates.baseSalary !== undefined) {
      updateData.baseSalary = updates.baseSalary
    }

    if (updates.currency !== undefined) {
      updateData.currency = updates.currency
    }

    if (updates.notes !== undefined) {
      updateData.notes =
        updates.notes === null ? null : updates.notes
    }

    const updated =
      await prisma.employeeContract.update({
        where: { id },
        data: updateData,
        select: contractSelect,
      })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "CONTRACT_UPDATED",
      entityType: "EmployeeContract",
      entityId: id,
      metadata: {
        contractNumber: updated.contractNumber,
        updatedFields: Object.keys(updateData),
      },
      ...clientInfo,
    })

    response.status(200).json({
      contract: updated,
    })
  },
)

// PATCH /api/v1/contracts/:id/status
// Update contract status (ADMIN / HR_MANAGER only)
contractRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const paramsResult = contractIdParamSchema.safeParse(
      request.params,
    )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid contract ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult =
      updateContractStatusSchema.safeParse(request.body)

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid status data",
          fields: bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const { status: newStatus } = bodyResult.data

    // Check if contract exists
    const contract =
      await prisma.employeeContract.findUnique({
        where: { id },
      })

    if (!contract) {
      response.status(404).json({
        error: {
          code: "CONTRACT_NOT_FOUND",
          message: "Contract not found",
        },
      })

      return
    }

    // Validate status transitions
    const validTransitions: Record<
      ContractStatus,
      ContractStatus[]
    > = {
      [ContractStatus.DRAFT]: [
        ContractStatus.ACTIVE,
        ContractStatus.CANCELLED,
      ],
      [ContractStatus.ACTIVE]: [
        ContractStatus.EXPIRED,
        ContractStatus.TERMINATED,
      ],
      [ContractStatus.EXPIRED]: [],
      [ContractStatus.TERMINATED]: [],
      [ContractStatus.CANCELLED]: [],
    }

    if (
      !validTransitions[contract.status].includes(
        newStatus,
      )
    ) {
      response.status(409).json({
        error: {
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot transition from ${contract.status} to ${newStatus}`,
        },
      })

      return
    }

    // If moving to ACTIVE, check for conflicts
    if (newStatus === ContractStatus.ACTIVE) {
      const conflictingContract =
        await prisma.employeeContract.findFirst({
          where: {
            employeeId: contract.employeeId,
            status: ContractStatus.ACTIVE,
            id: { not: id },
            OR: [
              {
                // Overlap check
                startDate: {
                  lte: contract.endDate ?? new Date("2099-12-31"),
                },
                endDate: {
                  gte: contract.startDate,
                },
              },
            ],
          },
        })

      if (conflictingContract) {
        response.status(409).json({
          error: {
            code: "CONFLICTING_ACTIVE_CONTRACT",
            message:
              "Employee has an overlapping active contract",
          },
        })

        return
      }
    }

    const updated =
      await prisma.employeeContract.update({
        where: { id },
        data: { status: newStatus },
        select: contractSelect,
      })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "CONTRACT_STATUS_CHANGED",
      entityType: "EmployeeContract",
      entityId: id,
      metadata: {
        contractNumber: contract.contractNumber,
        previousStatus: contract.status,
        newStatus,
      },
      ...clientInfo,
    })

    response.status(200).json({
      contract: updated,
    })
  },
)
