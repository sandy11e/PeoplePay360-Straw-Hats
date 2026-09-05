export interface AuditLogItem {
  id: string
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  actorUser?: {
    id: string
    email: string
    role: string
  } | null
}

export interface AuditLogListResponse {
  auditLogs: AuditLogItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
