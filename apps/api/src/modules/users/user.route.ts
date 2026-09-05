import bcrypt from "bcryptjs"
import { Router } from "express"

import { type AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  ADMIN_ONLY,
  requireRole,
} from "../../auth/auth.roles.js"
import { UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { extractClientInfo, recordAuditLog } from "../audit/audit.service.js"

import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdParamSchema,
  userListQuerySchema,
} from "./user.schema.js"

export const userRouter = Router()

const userSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const

// POST /api/v1/users
// Create a new user (ADMIN only)
userRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request, response) => {
    const parsed = createUserSchema.safeParse(
      request.body,
    )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid user data",
          fields: parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { email, password, role } = parsed.data

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      response.status(409).json({
        error: {
          code: "USER_EXISTS",
          message: "A user with this email already exists",
        },
      })

      return
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        isActive: true,
      },

      select: userSelect,
    })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      ...clientInfo,
    })

    response.status(201).json({
      user,
    })
  },
)

// GET /api/v1/users
// List all users with pagination (ADMIN only)
userRouter.get(
  "/",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request, response) => {
    const parsed = userListQuerySchema.safeParse(
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

    const { page, pageSize } = parsed.data

    const skip = (page - 1) * pageSize

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: userSelect,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.user.count(),
    ])

    response.status(200).json({
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },
)

// GET /api/v1/users/:id
// Get user by ID (ADMIN only)
userRouter.get(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request, response) => {
    const parsed = userIdParamSchema.safeParse(
      request.params,
    )

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid user ID",
          fields: parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    })

    if (!user) {
      response.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })

      return
    }

    response.status(200).json({
      user,
    })
  },
)

// PATCH /api/v1/users/:id
// Update user (ADMIN only)
userRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request, response) => {
    const paramsResult = userIdParamSchema.safeParse(
      request.params,
    )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid user ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult = updateUserSchema.safeParse(
      request.body,
    )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid user data",
          fields: bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const updates = bodyResult.data

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      response.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })

      return
    }

    // If email is being changed, check for duplicates
    if (updates.email && updates.email !== user.email) {
      const existing = await prisma.user.findUnique(
        {
          where: { email: updates.email },
        },
      )

      if (existing) {
        response.status(409).json({
          error: {
            code: "USER_EXISTS",
            message:
              "A user with this email already exists",
          },
        })

        return
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    if (updates.email !== undefined) {
      updateData.email = updates.email
    }

    if (updates.role !== undefined) {
      // Role escalation protection: administrators cannot change their own role
      if (auth && auth.userId === id && updates.role !== user.role) {
        response.status(400).json({
          error: {
            code: "ROLE_MODIFICATION_RESTRICTED",
            message: "Cannot modify your own user role",
          },
        })
        return
      }
      updateData.role = updates.role
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive

      // If deactivating, revoke all refresh tokens
      if (updates.isActive === false) {
        await prisma.refreshToken.updateMany({
          where: {
            userId: id,
            revokedAt: null,
          },

          data: {
            revokedAt: new Date(),
          },
        })
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    })

    // Audit logs for user updates
    if (updates.role !== undefined && updates.role !== user.role) {
      await recordAuditLog({
        actorUserId: auth?.userId,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: id,
        metadata: {
          previousRole: user.role,
          newRole: updates.role,
        },
        ...clientInfo,
      })
    }

    if (updates.isActive !== undefined && updates.isActive !== user.isActive) {
      await recordAuditLog({
        actorUserId: auth?.userId,
        action: updates.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
        entityType: "User",
        entityId: id,
        metadata: {
          email: user.email,
          previousActive: user.isActive,
          newActive: updates.isActive,
        },
        ...clientInfo,
      })
    }

    if (updates.email !== undefined && updates.email !== user.email) {
      await recordAuditLog({
        actorUserId: auth?.userId,
        action: "USER_EMAIL_UPDATED",
        entityType: "User",
        entityId: id,
        metadata: {
          previousEmail: user.email,
          newEmail: updates.email,
        },
        ...clientInfo,
      })
    }

    response.status(200).json({
      user: updated,
    })
  },
)

// POST /api/v1/users/:id/reset-password
// Reset user password (ADMIN only)
userRouter.post(
  "/:id/reset-password",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request, response) => {
    const paramsResult = userIdParamSchema.safeParse(
      request.params,
    )

    if (!paramsResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid user ID",
          fields:
            paramsResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const bodyResult = resetPasswordSchema.safeParse(
      request.body,
    )

    if (!bodyResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          fields: bodyResult.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { id } = paramsResult.data
    const { newPassword } = bodyResult.data

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      response.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      })

      return
    }

    // Hash new password and revoke all refresh tokens
    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { passwordHash },
      }),

      prisma.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      }),
    ])

    const updated = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    })

    const auth = response.locals.auth as AuthContext | undefined
    const clientInfo = extractClientInfo(request)

    await recordAuditLog({
      actorUserId: auth?.userId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: id,
      metadata: {
        email: user.email,
        initiatedByAdmin: true,
      },
      ...clientInfo,
    })

    response.status(200).json({
      user: updated,
    })
  },
)
