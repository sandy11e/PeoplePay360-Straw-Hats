import type { Request } from "express"

import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import type { AuditLogQueryInput } from "./audit.schema.js"

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "refreshtoken",
  "accesstoken",
  "secret",
  "jwt",
  "authorization",
  "cookie",
  "database_url",
  "smtppassword",
  "smtp_password",
  "credentials",
  "privatekey",
]

const JWT_PATTERN = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/
const DB_URI_PATTERN = /postgres(ql)?:\/\/[^:]+:[^@]+@/i

/**
 * Checks whether an object property name represents a secret or credential.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "")
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive.replace(/[-_]/g, "")))
}

/**
 * Recursively strips sensitive properties and masks secret values from audit metadata.
 */
export function sanitizeAuditMetadata(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val
  }

  if (typeof val === "string") {
    if (JWT_PATTERN.test(val) || DB_URI_PATTERN.test(val)) {
      return "[REDACTED_SECRET]"
    }
    return val
  }

  if (typeof val !== "object") {
    return val
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeAuditMetadata(item))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      // NEVER record secrets in audit logs
      continue
    }
    sanitized[k] = sanitizeAuditMetadata(v)
  }

  return sanitized
}

/**
 * Extracts client IP and User-Agent from Express request safely.
 */
export function extractClientInfo(request?: Request): {
  ipAddress?: string | null | undefined
  userAgent?: string | null | undefined
} {
  if (!request) {
    return {}
  }

  const forwarded = request.header("x-forwarded-for")
  const rawIp =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ||
    request.ip ||
    request.socket?.remoteAddress

  const userAgent = request.header("user-agent")

  return {
    ipAddress: rawIp ? rawIp.slice(0, 45) : null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
  }
}

export interface RecordAuditLogParams {
  actorUserId?: string | null | undefined
  action: string
  entityType: string
  entityId?: string | null | undefined
  metadata?: unknown
  ipAddress?: string | null | undefined
  userAgent?: string | null | undefined
}

/**
 * Append an audit log entry.
 * Note: Audit logs are strictly append-only. No updates or deletions are exposed.
 */
export async function recordAuditLog(params: RecordAuditLogParams) {
  try {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      ipAddress: params.ipAddress ? params.ipAddress.slice(0, 45) : null,
      userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
    }

    if (params.metadata !== undefined && params.metadata !== null) {
      data.metadata = sanitizeAuditMetadata(params.metadata) as Prisma.InputJsonValue
    }

    return await prisma.auditLog.create({
      data,
    })
  } catch (error) {
    // Failure to record audit log should be logged on server without crashing client response
    console.error("[AuditService] Failed to record audit log:", error)
    return null
  }
}

/**
 * Query audit logs with pagination and filters (ADMIN only).
 */
export async function listAuditLogs(query: AuditLogQueryInput) {
  const { page, pageSize, action, entityType, entityId, actorUserId, startDate, endDate } = query

  const where: Prisma.AuditLogWhereInput = {}

  if (action) {
    where.action = action
  }

  if (entityType) {
    where.entityType = entityType
  }

  if (entityId) {
    where.entityId = entityId
  }

  if (actorUserId) {
    where.actorUserId = actorUserId
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      if (endDate.length === 10) {
        end.setUTCHours(23, 59, 59, 999)
      }
      where.createdAt.lte = end
    }
  }

  const skip = (page - 1) * pageSize

  const [auditLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    auditLogs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
