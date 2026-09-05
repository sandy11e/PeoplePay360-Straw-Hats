import { Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import { requireRole } from "../../auth/auth.roles.js"
import { UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"

import {
  createEmployeeSchema,
  employeeIdParamSchema,
  employeeListQuerySchema,
} from "./employee.schema.js"

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