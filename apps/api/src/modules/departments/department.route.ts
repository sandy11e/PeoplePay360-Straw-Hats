import { Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { prisma } from "../../lib/prisma.js"

import { createDepartmentSchema, departmentIdParamSchema, updateDepartmentSchema } from "./department.schema.js"

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

// PATCH /api/v1/departments/:id
// Update department (ADMIN / HR_MANAGER)
departmentRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const paramsResult =
      departmentIdParamSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid department ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult =
      updateDepartmentSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid department data",
          fields:
            bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const updates = bodyResult.data

    // Check if department exists
    const department =
      await prisma.department.findUnique({
        where: { id },
      })

    if (!department) {
      response.status(404).json({
        error: {
          code: "DEPARTMENT_NOT_FOUND",
          message: "Department not found",
        },
      })

      return
    }

    // Check for duplicate code or name if being updated
    if (
      updates.code ||
      updates.name
    ) {
      const orConditions: Array<Record<string, string>> = []

      if (updates.code) {
        orConditions.push({ code: updates.code })
      }

      if (updates.name) {
        orConditions.push({ name: updates.name })
      }

      const duplicate =
        await prisma.department.findFirst({
          where: {
            OR: orConditions,
            id: { not: id },
          },
        })

      if (duplicate) {
        response.status(409).json({
          error: {
            code: "DEPARTMENT_EXISTS",
            message:
              "Department code or name already exists",
          },
        })

        return
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (updates.code !== undefined) {
      updateData.code = updates.code
    }

    if (updates.name !== undefined) {
      updateData.name = updates.name
    }

    if (updates.description !== undefined) {
      updateData.description =
        updates.description === null
          ? null
          : updates.description
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive
    }

    const updated = await prisma.department.update({
      where: { id },
      data: updateData,
    })

    response.status(200).json({
      department: updated,
    })
  },
)