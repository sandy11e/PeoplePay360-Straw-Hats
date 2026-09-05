import { Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { prisma } from "../../lib/prisma.js"

import { createJobPositionSchema, jobPositionIdParamSchema, updateJobPositionSchema } from "./job-position.schema.js"

export const jobPositionRouter = Router()

jobPositionRouter.post(
  "/",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const parsed =
      createJobPositionSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid job position data",
          fields:
            parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const existing =
      await prisma.jobPosition.findFirst({
        where: {
          OR: [
            {
              code: parsed.data.code,
            },
            {
              title: parsed.data.title,
            },
          ],
        },
      })

    if (existing) {
      response.status(409).json({
        error: {
          code: "JOB_POSITION_EXISTS",
          message:
            "Job position code or title already exists",
        },
      })

      return
    }

    const jobPosition =
      await prisma.jobPosition.create({
 data: {
  code: parsed.data.code,
  title: parsed.data.title,
  description: parsed.data.description ?? null,
},
      })

    response.status(201).json({
      jobPosition,
    })
  },
)

jobPositionRouter.get(
  "/",
  requireAuth,
  async (_request, response) => {
    const jobPositions =
      await prisma.jobPosition.findMany({
        orderBy: {
          title: "asc",
        },
      })

    response.status(200).json({
      jobPositions,
    })
  },
)

// PATCH /api/v1/job-positions/:id
// Update job position (ADMIN / HR_MANAGER)
jobPositionRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request, response) => {
    const paramsResult =
      jobPositionIdParamSchema.safeParse(
        request.params,
      )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid job position ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult =
      updateJobPositionSchema.safeParse(
        request.body,
      )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid job position data",
          fields:
            bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const updates = bodyResult.data

    // Check if job position exists
    const jobPosition =
      await prisma.jobPosition.findUnique({
        where: { id },
      })

    if (!jobPosition) {
      response.status(404).json({
        error: {
          code: "JOB_POSITION_NOT_FOUND",
          message: "Job position not found",
        },
      })

      return
    }

    // Check for duplicate code or title if being updated
    if (
      updates.code ||
      updates.title
    ) {
      const orConditions: Array<Record<string, string>> = []

      if (updates.code) {
        orConditions.push({ code: updates.code })
      }

      if (updates.title) {
        orConditions.push({ title: updates.title })
      }

      const duplicate =
        await prisma.jobPosition.findFirst({
          where: {
            OR: orConditions,
            id: { not: id },
          },
        })

      if (duplicate) {
        response.status(409).json({
          error: {
            code: "JOB_POSITION_EXISTS",
            message:
              "Job position code or title already exists",
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

    if (updates.title !== undefined) {
      updateData.title = updates.title
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

    const updated = await prisma.jobPosition.update({
      where: { id },
      data: updateData,
    })

    response.status(200).json({
      jobPosition: updated,
    })
  },
)