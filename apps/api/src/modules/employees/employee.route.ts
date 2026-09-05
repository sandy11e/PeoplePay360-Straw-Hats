import { Router } from "express"

import { type AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  PAYROLL_MANAGE_ACCESS,
  requireRole,
  SALARY_ASSIGNMENT_READ_ACCESS,
  SCHEDULE_READ_ACCESS,
} from "../../auth/auth.roles.js"
import { UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { extractClientInfo, recordAuditLog } from "../audit/audit.service.js"

import {
  bulkImportEmployeesSchema,
  createEmployeeSchema,
  employeeIdParamSchema,
  employeeListQuerySchema,
  updateEmployeeSchema,
  updateEmploymentStatusSchema,
} from "./employee.schema.js"

import {
  ContractStatus,
  EmploymentStatus,
} from "../../generated/prisma/enums.js"

import {
  employeeContractListQuerySchema,
  employeeIdParamSchema as contractEmployeeIdParamSchema,
} from "../contracts/contract.schema.js"

import {
  assignEmployeeScheduleHandler,
  getEmployeeSchedulesHandler,
} from "../work-schedules/work-schedule.route.js"

import {
  getEmployeeAttendanceHandler,
} from "../attendance/attendance.route.js"

import {
  getEmployeeLeaveBalancesHandler,
} from "../leave/leave.route.js"

import {
  assignEmployeeSalaryStructureHandler,
  getEmployeeSalaryStructuresHandler,
} from "../salary-structures/salary-structure.route.js"

export const employeeRouter = Router()

const DIRECTORY_ROLES = [
  UserRole.ADMIN,
  UserRole.HR_MANAGER,
  UserRole.PAYROLL_MANAGER,
  UserRole.PAYROLL_USER,
]

const employeeSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  workEmail: true,
  phone: true,
  joiningDate: true,
  employmentStatus: true,

  department: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  jobPosition: {
    select: {
      id: true,
      code: true,
      title: true,
    },
  },

  manager: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },

  user: {
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  },

  createdAt: true,
  updatedAt: true,
} as const

employeeRouter.post(
  "/",
  requireAuth,
  requireRole(
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
  ),
  async (request, response) => {
    const parsed =
      createEmployeeSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee data",
          fields:
            parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const data = parsed.data

    const department =
      await prisma.department.findFirst({
        where: {
          id: data.departmentId,
          isActive: true,
        },
      })

    if (!department) {
      response.status(400).json({
        error: {
          code: "INVALID_DEPARTMENT",
          message:
            "Department does not exist or is inactive",
        },
      })

      return
    }

    const jobPosition =
      await prisma.jobPosition.findFirst({
        where: {
          id: data.jobPositionId,
          isActive: true,
        },
      })

    if (!jobPosition) {
      response.status(400).json({
        error: {
          code: "INVALID_JOB_POSITION",
          message:
            "Job position does not exist or is inactive",
        },
      })

      return
    }

    if (data.managerId) {
      const manager =
        await prisma.employee.findUnique({
          where: {
            id: data.managerId,
          },
        })

      if (!manager) {
        response.status(400).json({
          error: {
            code: "INVALID_MANAGER",
            message:
              "Selected manager does not exist",
          },
        })

        return
      }
    }

    if (data.userId) {
      const user =
        await prisma.user.findUnique({
          where: {
            id: data.userId,
          },
        })

      if (!user) {
        response.status(400).json({
          error: {
            code: "INVALID_USER",
            message:
              "Selected user account does not exist",
          },
        })

        return
      }

      const linked =
        await prisma.employee.findUnique({
          where: {
            userId: data.userId,
          },
        })

      if (linked) {
        response.status(409).json({
          error: {
            code: "USER_ALREADY_LINKED",
            message:
              "User account is already linked to an employee",
          },
        })

        return
      }
    }

    const duplicate =
      await prisma.employee.findFirst({
        where: {
          OR: [
            {
              employeeCode:
                data.employeeCode,
            },
            {
              workEmail:
                data.workEmail,
            },
          ],
        },
      })

    if (duplicate) {
      response.status(409).json({
        error: {
          code: "EMPLOYEE_EXISTS",
          message:
            "Employee code or work email already exists",
        },
      })

      return
    }

    const employee =
      await prisma.employee.create({
        data: {
          employeeCode:
            data.employeeCode,

          firstName:
            data.firstName,

          middleName:
            data.middleName ?? null,

          lastName:
            data.lastName,

          workEmail:
            data.workEmail,

          phone:
            data.phone ?? null,

          joiningDate: new Date(
            `${data.joiningDate}T00:00:00.000Z`,
          ),

          departmentId:
            data.departmentId,

          jobPositionId:
            data.jobPositionId,

          managerId:
            data.managerId ?? null,

          userId:
            data.userId ?? null,
        },

        select: employeeSelect,
      })

    response.status(201).json({
      employee,
    })
  },
)

employeeRouter.get(
  "/",
  requireAuth,
  requireRole(...DIRECTORY_ROLES),
  async (request, response) => {
    const parsed =
      employeeListQuerySchema.safeParse(
        request.query,
      )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Invalid pagination parameters",
          fields:
            parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const {
      page,
      pageSize,
    } = parsed.data

    const skip =
      (page - 1) * pageSize

    const [
      employees,
      total,
    ] = await prisma.$transaction([
      prisma.employee.findMany({
        skip,
        take: pageSize,

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            employeeCode: "asc",
          },
        ],

        select: employeeSelect,
      }),

      prisma.employee.count(),
    ])

    response.status(200).json({
      employees,

      pagination: {
        page,
        pageSize,
        total,
        totalPages:
          Math.ceil(total / pageSize),
      },
    })
  },
)

// POST /api/v1/employees/bulk-import
employeeRouter.post(
  "/bulk-import",
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (request, response) => {
    const parsed = bulkImportEmployeesSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid bulk import payload",
          fields: parsed.error.flatten().fieldErrors,
        },
      })
      return
    }

    const {
      employees: items,
      autoCreateContract,
      assignDefaultSchedule,
      allocateDefaultLeaves,
    } = parsed.data

    // Fetch reference data for flexible lookup
    const [
      allDepts,
      allPositions,
      allSalaryStructures,
      defaultSchedule,
      allActiveLeaveTypes,
    ] = await Promise.all([
      prisma.department.findMany(),
      prisma.jobPosition.findMany(),
      prisma.salaryStructure.findMany({ where: { isActive: true } }),
      assignDefaultSchedule
        ? prisma.workSchedule.findFirst({ where: { isActive: true } })
        : null,
      allocateDefaultLeaves
        ? prisma.leaveType.findMany({ where: { isActive: true } })
        : [],
    ])

    const deptMap = new Map<string, (typeof allDepts)[0]>()
    for (const d of allDepts) {
      deptMap.set(d.id.toLowerCase(), d)
      deptMap.set(d.code.toLowerCase(), d)
      deptMap.set(d.name.toLowerCase(), d)
    }

    const posMap = new Map<string, (typeof allPositions)[0]>()
    for (const p of allPositions) {
      posMap.set(p.id.toLowerCase(), p)
      posMap.set(p.code.toLowerCase(), p)
      posMap.set(p.title.toLowerCase(), p)
    }

    const structureMap = new Map<string, (typeof allSalaryStructures)[0]>()
    for (const s of allSalaryStructures) {
      structureMap.set(s.id.toLowerCase(), s)
      structureMap.set(s.code.toLowerCase(), s)
      structureMap.set(s.name.toLowerCase(), s)
    }

    // Lookup existing employee codes and emails in DB
    const inputCodes = items.map((i) => i.employeeCode)
    const inputEmails = items.map((i) => i.workEmail)

    const existingEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          { employeeCode: { in: inputCodes } },
          { workEmail: { in: inputEmails } },
        ],
      },
      select: { employeeCode: true, workEmail: true },
    })

    const existingCodesSet = new Set(
      existingEmployees.map((e) => e.employeeCode.toUpperCase()),
    )
    const existingEmailsSet = new Set(
      existingEmployees.map((e) => e.workEmail.toLowerCase()),
    )

    // Track duplicates inside the incoming batch
    const seenBatchCodes = new Set<string>()
    const seenBatchEmails = new Set<string>()

    const imported: unknown[] = []
    const errors: Array<{
      rowNumber: number
      employeeCode?: string
      workEmail?: string
      reason: string
    }> = []

    async function resolveDepartment(input: string) {
      const key = input.toLowerCase().trim()
      if (deptMap.has(key)) return deptMap.get(key)!
      // Auto-create missing department so admins are not blocked by naming variations
      const code =
        input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) ||
        `DEPT_${Date.now() % 10000}`
      const name = input.trim()
      try {
        const created = await prisma.department.create({
          data: { code, name, isActive: true },
        })
        deptMap.set(created.id.toLowerCase(), created)
        deptMap.set(created.code.toLowerCase(), created)
        deptMap.set(created.name.toLowerCase(), created)
        return created
      } catch {
        return (
          allDepts.find((d) => d.isActive) ??
          (await prisma.department.findFirst({ where: { isActive: true } }))
        )
      }
    }

    async function resolveJobPosition(input: string) {
      const key = input.toLowerCase().trim()
      if (posMap.has(key)) return posMap.get(key)!
      // Auto-create missing job position
      const code =
        input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) ||
        `POS_${Date.now() % 10000}`
      const title = input.trim()
      try {
        const created = await prisma.jobPosition.create({
          data: { code, title, isActive: true },
        })
        posMap.set(created.id.toLowerCase(), created)
        posMap.set(created.code.toLowerCase(), created)
        posMap.set(created.title.toLowerCase(), created)
        return created
      } catch {
        return (
          allPositions.find((p) => p.isActive) ??
          (await prisma.jobPosition.findFirst({ where: { isActive: true } }))
        )
      }
    }

    for (let index = 0; index < items.length; index++) {
      const rowNumber = index + 1
      const item = items[index]
      if (!item) continue

      // Check duplicate in DB
      if (existingCodesSet.has(item.employeeCode)) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Employee code '${item.employeeCode}' already exists in the system`,
        })
        continue
      }
      if (existingEmailsSet.has(item.workEmail)) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Work email '${item.workEmail}' already exists in the system`,
        })
        continue
      }

      // Check duplicate in current batch
      if (seenBatchCodes.has(item.employeeCode)) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Duplicate employee code '${item.employeeCode}' within the uploaded batch`,
        })
        continue
      }
      if (seenBatchEmails.has(item.workEmail)) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Duplicate work email '${item.workEmail}' within the uploaded batch`,
        })
        continue
      }

      // Resolve department
      const dept = await resolveDepartment(item.department)
      if (!dept) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Could not resolve or create department '${item.department}'`,
        })
        continue
      }

      // Resolve position
      const pos = await resolveJobPosition(item.jobPosition)
      if (!pos) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason: `Could not resolve or create job position '${item.jobPosition}'`,
        })
        continue
      }

      // Resolve manager if specified
      let managerId: string | null = null
      if (item.manager) {
        const manager = await prisma.employee.findFirst({
          where: {
            OR: [
              { id: item.manager },
              { employeeCode: item.manager.toUpperCase() },
              { workEmail: item.manager.toLowerCase() },
            ],
          },
        })
        if (manager) {
          managerId = manager.id
        }
      }

      try {
        const joiningDate = new Date(`${item.joiningDate}T00:00:00.000Z`)

        // Create employee
        const createdEmp = await prisma.employee.create({
          data: {
            employeeCode: item.employeeCode,
            firstName: item.firstName,
            middleName: item.middleName || null,
            lastName: item.lastName,
            workEmail: item.workEmail,
            phone: item.phone || null,
            joiningDate,
            employmentStatus: item.employmentStatus ?? EmploymentStatus.ACTIVE,
            departmentId: dept.id,
            jobPositionId: pos.id,
            managerId,
          },
          select: employeeSelect,
        })

        seenBatchCodes.add(item.employeeCode)
        seenBatchEmails.add(item.workEmail)
        existingCodesSet.add(item.employeeCode)
        existingEmailsSet.add(item.workEmail)

        // 1. Auto-create contract if baseSalary provided
        if (autoCreateContract && item.baseSalary && item.baseSalary > 0) {
          const contractNumber = `CON-${item.employeeCode}`
          const existingContract = await prisma.employeeContract.findUnique({
            where: { contractNumber },
          })
          await prisma.employeeContract.create({
            data: {
              contractNumber: existingContract
                ? `${contractNumber}-${Date.now() % 10000}`
                : contractNumber,
              employeeId: createdEmp.id,
              startDate: joiningDate,
              baseSalary: item.baseSalary,
              currency: item.currency || "USD",
              status: ContractStatus.ACTIVE,
            },
          })
        }

        // 2. Assign salary structure if specified
        if (item.salaryStructure) {
          const targetStructure = structureMap.get(
            item.salaryStructure.toLowerCase().trim(),
          )
          if (targetStructure) {
            await prisma.employeeSalaryStructureAssignment.create({
              data: {
                employeeId: createdEmp.id,
                structureId: targetStructure.id,
                effectiveFrom: joiningDate,
              },
            })
          }
        }

        // 3. Assign default work schedule
        if (assignDefaultSchedule && defaultSchedule) {
          await prisma.employeeScheduleAssignment.create({
            data: {
              employeeId: createdEmp.id,
              scheduleId: defaultSchedule.id,
              effectiveFrom: joiningDate,
            },
          })
        }

        // 4. Allocate default leave types for current year
        if (allocateDefaultLeaves && allActiveLeaveTypes.length > 0) {
          const currentYear = new Date().getFullYear()
          for (const lt of allActiveLeaveTypes) {
            await prisma.leaveAllocation.upsert({
              where: {
                employeeId_leaveTypeId_year: {
                  employeeId: createdEmp.id,
                  leaveTypeId: lt.id,
                  year: currentYear,
                },
              },
              create: {
                employeeId: createdEmp.id,
                leaveTypeId: lt.id,
                year: currentYear,
                allocatedDays: 15,
                usedDays: 0,
              },
              update: {},
            })
          }
        }

        imported.push(createdEmp)
      } catch (err) {
        errors.push({
          rowNumber,
          employeeCode: item.employeeCode,
          workEmail: item.workEmail,
          reason:
            err instanceof Error
              ? err.message
              : "Failed to create employee record",
        })
      }
    }

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "EMPLOYEES_BULK_IMPORTED",
      entityType: "Employee",
      entityId: null,
      metadata: {
        totalRequested: items.length,
        importedCount: imported.length,
        failedCount: errors.length,
      },
      ...clientInfo,
    })

    response.status(200).json({
      totalProcessed: items.length,
      importedCount: imported.length,
      failedCount: errors.length,
      imported,
      errors,
    })
  },
)

employeeRouter.get(
  "/:id",
  requireAuth,
  requireRole(...DIRECTORY_ROLES),
  async (request, response) => {
    const parsedParams =
      employeeIdParamSchema.safeParse(
        request.params,
      )

    if (!parsedParams.success) {
      response.status(400).json({
        error: {
          code: "INVALID_EMPLOYEE_ID",
          message:
            "Employee ID must be a valid UUID",
        },
      })

      return
    }

    const employee =
      await prisma.employee.findUnique({
        where: {
          id: parsedParams.data.id,
        },

        select: employeeSelect,
      })

    if (!employee) {
      response.status(404).json({
        error: {
          code: "EMPLOYEE_NOT_FOUND",
          message: "Employee not found",
        },
      })

      return
    }

    response.status(200).json({
      employee,
    })
  },
)

// PATCH /api/v1/employees/:id
// Update employee details (ADMIN / HR_MANAGER)
employeeRouter.patch(
  "/:id",
  requireAuth,
  requireRole(
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
  ),
  async (request, response) => {
    const paramsResult =
      employeeIdParamSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult =
      updateEmployeeSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee data",
          fields:
            bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const updates = bodyResult.data

    // Check if employee exists
    const employee =
      await prisma.employee.findUnique({
        where: { id },
      })

    if (!employee) {
      response.status(404).json({
        error: {
          code: "EMPLOYEE_NOT_FOUND",
          message: "Employee not found",
        },
      })

      return
    }

    // Validate department if being updated
    if (updates.departmentId) {
      const department =
        await prisma.department.findFirst({
          where: {
            id: updates.departmentId,
            isActive: true,
          },
        })

      if (!department) {
        response.status(400).json({
          error: {
            code: "INVALID_DEPARTMENT",
            message:
              "Department does not exist or is inactive",
          },
        })

        return
      }
    }

    // Validate job position if being updated
    if (updates.jobPositionId) {
      const jobPosition =
        await prisma.jobPosition.findFirst({
          where: {
            id: updates.jobPositionId,
            isActive: true,
          },
        })

      if (!jobPosition) {
        response.status(400).json({
          error: {
            code: "INVALID_JOB_POSITION",
            message:
              "Job position does not exist or is inactive",
          },
        })

        return
      }
    }

    // Validate manager if being updated
    if (
      updates.managerId !== undefined &&
      updates.managerId !== null
    ) {
      // Manager cannot be self
      if (updates.managerId === id) {
        response.status(400).json({
          error: {
            code: "INVALID_MANAGER",
            message: "Employee cannot be their own manager",
          },
        })

        return
      }

      const manager =
        await prisma.employee.findUnique({
          where: { id: updates.managerId },
        })

      if (!manager) {
        response.status(400).json({
          error: {
            code: "INVALID_MANAGER",
            message: "Manager does not exist",
          },
        })

        return
      }
    }

    // Validate user if being updated
    if (updates.userId !== undefined) {
      if (updates.userId !== null) {
        const user =
          await prisma.user.findUnique({
            where: { id: updates.userId },
          })

        if (!user) {
          response.status(400).json({
            error: {
              code: "INVALID_USER",
              message:
                "Selected user account does not exist",
            },
          })

          return
        }

        // Check if user is already linked to another employee
        const linked =
          await prisma.employee.findFirst({
            where: {
              userId: updates.userId,
              id: { not: id },
            },
          })

        if (linked) {
          response.status(409).json({
            error: {
              code: "USER_ALREADY_LINKED",
              message:
                "User account is already linked to an employee",
            },
          })

          return
        }
      }
    }

    // Check for duplicate workEmail if being updated
    if (
      updates.workEmail &&
      updates.workEmail !== employee.workEmail
    ) {
      const duplicate =
        await prisma.employee.findFirst({
          where: {
            workEmail: updates.workEmail,
            id: { not: id },
          },
        })

      if (duplicate) {
        response.status(409).json({
          error: {
            code: "WORK_EMAIL_EXISTS",
            message:
              "This work email is already in use",
          },
        })

        return
      }
    }

    // Prepare update data - use null explicitly when undefined
    const updateData: Record<string, unknown> = {}

    if (updates.firstName !== undefined) {
      updateData.firstName = updates.firstName
    }

    if (updates.middleName !== undefined) {
      updateData.middleName =
        updates.middleName === null
          ? null
          : updates.middleName
    }

    if (updates.lastName !== undefined) {
      updateData.lastName = updates.lastName
    }

    if (updates.workEmail !== undefined) {
      updateData.workEmail = updates.workEmail
    }

    if (updates.phone !== undefined) {
      updateData.phone =
        updates.phone === null ? null : updates.phone
    }

    if (updates.departmentId !== undefined) {
      updateData.departmentId = updates.departmentId
    }

    if (updates.jobPositionId !== undefined) {
      updateData.jobPositionId = updates.jobPositionId
    }

    if (updates.managerId !== undefined) {
      updateData.managerId =
        updates.managerId === null
          ? null
          : updates.managerId
    }

    if (updates.userId !== undefined) {
      updateData.userId =
        updates.userId === null ? null : updates.userId
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData,
      select: employeeSelect,
    })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: id,
      metadata: {
        employeeCode: updated.employeeCode,
        updatedFields: Object.keys(updateData),
      },
      ...clientInfo,
    })

    response.status(200).json({
      employee: updated,
    })
  },
)

// PATCH /api/v1/employees/:id/status
// Update employee employment status (ADMIN / HR_MANAGER)
employeeRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole(
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
  ),
  async (request, response) => {
    const paramsResult =
      employeeIdParamSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult =
      updateEmploymentStatusSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid status data",
          fields:
            bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const { status } = bodyResult.data

    // Check if employee exists
    const employee =
      await prisma.employee.findUnique({
        where: { id },
      })

    if (!employee) {
      response.status(404).json({
        error: {
          code: "EMPLOYEE_NOT_FOUND",
          message: "Employee not found",
        },
      })

      return
    }

    // Update employment status
    const updated = await prisma.employee.update({
      where: { id },
      data: { employmentStatus: status },
      select: employeeSelect,
    })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "EMPLOYMENT_STATUS_CHANGED",
      entityType: "Employee",
      entityId: id,
      metadata: {
        employeeCode: employee.employeeCode,
        previousStatus: employee.employmentStatus,
        newStatus: status,
      },
      ...clientInfo,
    })

    response.status(200).json({
      employee: updated,
    })
  },
)

// GET /api/v1/employees/:employeeId/contracts
// Get all contracts for an employee (ADMIN / HR_MANAGER / PAYROLL_* only)
employeeRouter.get(
  "/:employeeId/contracts",
  requireAuth,
  requireRole(
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
    UserRole.PAYROLL_MANAGER,
    UserRole.PAYROLL_USER,
  ),
  async (request, response) => {
    const paramsResult =
      contractEmployeeIdParamSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const queryResult =
      employeeContractListQuerySchema.safeParse(
        request.query,
      )

    if (!queryResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          fields:
            queryResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { employeeId } = paramsResult.data
    const {
      page,
      pageSize,
      status,
    } = queryResult.data

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

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {
      employeeId,
    }

    if (status) {
      where.status = status
    }

    const contractSelect = {
      id: true,
      contractNumber: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      baseSalary: true,
      currency: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    } as const

    const [contracts, total] = await Promise.all([
      prisma.employeeContract.findMany({
        where,
        select: contractSelect,
        skip,
        take: pageSize,
        orderBy: {
          startDate: "desc",
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

// POST /api/v1/employees/:employeeId/work-schedules
// Assign a work schedule to an employee (ADMIN / HR_MANAGER only)
employeeRouter.post(
  "/:employeeId/work-schedules",
  requireAuth,
  requireRole(...HR_ACCESS),
  assignEmployeeScheduleHandler,
)

// GET /api/v1/employees/:employeeId/work-schedules
// Get work schedules assigned to an employee (ADMIN / HR_MANAGER / PAYROLL_* only)
employeeRouter.get(
  "/:employeeId/work-schedules",
  requireAuth,
  requireRole(...SCHEDULE_READ_ACCESS),
  getEmployeeSchedulesHandler,
)

// GET /api/v1/employees/:employeeId/attendance
// Get attendance records for an employee (ADMIN / HR_MANAGER / PAYROLL_* or self)
employeeRouter.get(
  "/:employeeId/attendance",
  requireAuth,
  getEmployeeAttendanceHandler,
)

// GET /api/v1/employees/:employeeId/leave-balances
// Get leave balances for an employee (ADMIN / HR_MANAGER / PAYROLL_* or self)
employeeRouter.get(
  "/:employeeId/leave-balances",
  requireAuth,
  getEmployeeLeaveBalancesHandler,
)

// POST /api/v1/employees/:employeeId/salary-structures
// Assign a salary structure to an employee (ADMIN / PAYROLL_MANAGER only)
employeeRouter.post(
  "/:employeeId/salary-structures",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  assignEmployeeSalaryStructureHandler,
)

// GET /api/v1/employees/:employeeId/salary-structures
// Get salary structure assignments for an employee (ADMIN / PAYROLL_MANAGER / PAYROLL_USER / HR_MANAGER)
employeeRouter.get(
  "/:employeeId/salary-structures",
  requireAuth,
  requireRole(...SALARY_ASSIGNMENT_READ_ACCESS),
  getEmployeeSalaryStructuresHandler,
)