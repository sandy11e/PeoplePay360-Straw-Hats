import { Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { prisma } from "../../lib/prisma.js"

import { createJobPositionSchema } from "./job-position.schema.js"

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