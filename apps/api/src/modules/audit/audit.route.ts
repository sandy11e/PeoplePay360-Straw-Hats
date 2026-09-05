import { Router, type Request, type Response } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import { ADMIN_ONLY, requireRole } from "../../auth/auth.roles.js"
import { auditLogQuerySchema } from "./audit.schema.js"
import { listAuditLogs } from "./audit.service.js"

export const auditRouter = Router()

/**
 * GET /api/v1/audit-logs
 * Read system audit logs with pagination and filters.
 * STRICTLY ADMIN ONLY.
 * Append-only by design: No UPDATE or DELETE endpoints exist.
 */
auditRouter.get(
  "/",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  async (request: Request, response: Response) => {
    const queryResult = auditLogQuerySchema.safeParse(request.query)

    if (!queryResult.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters for audit logs",
          fields: queryResult.error.flatten().fieldErrors,
        },
      })
      return
    }

    try {
      const result = await listAuditLogs(queryResult.data)
      response.status(200).json(result)
    } catch (error) {
      console.error("[AuditRouter] Error retrieving audit logs:", error)
      response.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while fetching audit logs",
        },
      })
    }
  },
)
