import { Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { prisma } from "../../lib/prisma.js"

import { createDepartmentSchema } from "./department.schema.js"

export const departmentRouter = Router()

departmentRouter.post(
  "/",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const parsed =
      createDepartmentSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid department data",
          fields:
            parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const existing =
      await prisma.department.findFirst({
        where: {
          OR: [
            {
              code: parsed.data.code,
            },
            {
              name: parsed.data.name,
            },
          ],
        },
      })

    if (existing) {
      response.status(409).json({
        error: {
          code: "DEPARTMENT_EXISTS",
          message:
            "Department code or name already exists",
        },
      })

      return
    }

    const department =
      await prisma.department.create({
        data: {
  code: parsed.data.code,
  name: parsed.data.name,
  description: parsed.data.description ?? null,
},
      })

    response.status(201).json({
      department,
    })
  },
)

departmentRouter.get(
  "/",
  requireAuth,
  async (_request, response) => {
    const departments =
      await prisma.department.findMany({
        orderBy: {
          name: "asc",
        },
      })

    response.status(200).json({
      departments,
    })
  },
)