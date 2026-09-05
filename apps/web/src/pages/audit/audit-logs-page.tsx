import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  EyeIcon,
  FilterIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  TerminalIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { AuditLogItem, AuditLogListResponse } from "@/types/audit"
import { formatDateTime } from "@/utils/format"

export function AuditLogsPage() {
  const { request } = useAuth()

  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [actionFilter, setActionFilter] = useState("")
  const [entityTypeFilter, setEntityTypeFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Inspect metadata modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("pageSize", "20")

      if (actionFilter.trim()) {
        params.set("action", actionFilter.trim())
      }
      if (entityTypeFilter.trim()) {
        params.set("entityType", entityTypeFilter.trim())
      }
      if (startDate) {
        params.set("startDate", startDate)
      }
      if (endDate) {
        params.set("endDate", endDate)
      }

      const res = await request<AuditLogListResponse>(
        `/audit-logs?${params.toString()}`,
      )
      setLogs(res.auditLogs)
      setTotalPages(res.pagination.totalPages)
      setTotalCount(res.pagination.total)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to load audit logs.")
    } finally {
      setIsLoading(false)
    }
  }, [actionFilter, entityTypeFilter, startDate, endDate, page, request])

  useEffect(() => {
    void loadAuditLogs()
  }, [loadAuditLogs])

  const handleResetFilters = () => {
    setActionFilter("")
    setEntityTypeFilter("")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  // Determine semantic action badge color
  const getActionColor = (action: string) => {
    if (action.includes("DELETE") || action.includes("CANCEL") || action.includes("FAIL")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
    }
    if (action.includes("CREATE") || action.includes("APPROVED") || action.includes("VALIDATE")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    }
    if (action.includes("UPDATE") || action.includes("RESET") || action.includes("STATUS")) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    }
    return "bg-muted text-muted-foreground border-border"
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlertIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              System Audit Logs
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Immutable, append-only chronological record of authentication events,
            privilege shifts, and business transactions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAuditLogs()}
          disabled={isLoading}
        >
          <RefreshCwIcon
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh Log
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircleIcon className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-medium">
                Log Filters & Date Window
              </CardTitle>
            </div>
            {(actionFilter || entityTypeFilter || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={handleResetFilters}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Action Filter */}
            <div>
              <label
                htmlFor="action-filter"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Action Event
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="action-filter"
                  placeholder="e.g. USER_CREATED, ROLE..."
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label
                htmlFor="entity-type-filter"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Target Entity Type
              </label>
              <select
                id="entity-type-filter"
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Entities</option>
                <option value="User">User</option>
                <option value="Employee">Employee</option>
                <option value="Contract">Contract</option>
                <option value="WorkSchedule">WorkSchedule</option>
                <option value="LeaveRequest">LeaveRequest</option>
                <option value="SalaryStructure">SalaryStructure</option>
                <option value="Payrun">Payrun</option>
                <option value="Payslip">Payslip</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="start-date"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                From Date
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="text-xs"
              />
            </div>

            {/* End Date */}
            <div>
              <label
                htmlFor="end-date"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                To Date
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Event Activity Stream
              </CardTitle>
              <CardDescription>
                {totalCount} total audit records captured
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="No audit log records"
              description="No audit events matched your search or filter parameters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Timestamp</th>
                    <th className="py-3 pr-4">Actor</th>
                    <th className="py-3 pr-4">Action Event</th>
                    <th className="py-3 pr-4">Entity Type</th>
                    <th className="py-3 pr-4">Target ID</th>
                    <th className="py-3 pr-4">Client IP</th>
                    <th className="py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      {/* Timestamp */}
                      <td className="py-3 pr-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Actor */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {log.actorUser ? (
                          <div>
                            <div className="font-semibold text-foreground">
                              {log.actorUser.email}
                            </div>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {log.actorUser.role}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-muted-foreground">
                            System
                          </span>
                        )}
                      </td>

                      {/* Action Event */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${getActionColor(
                            log.action,
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                        {log.entityType}
                      </td>

                      {/* Target Entity ID */}
                      <td className="py-3 pr-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {log.entityId ? (
                          <span title={log.entityId}>
                            {log.entityId.length > 14
                              ? `${log.entityId.slice(0, 8)}...`
                              : log.entityId}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Client IP */}
                      <td className="py-3 pr-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {log.ipAddress || "—"}
                      </td>

                      {/* View Metadata Action */}
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          title="Inspect payload metadata"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-muted-foreground">
                Showing page {page} of {totalPages} ({totalCount} total entries)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Metadata Inspector Modal */}
      {selectedLog && (
        <Dialog
          open={Boolean(selectedLog)}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null)
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-5 w-5 text-primary" />
                <DialogTitle className="font-mono text-base">
                  {selectedLog.action}
                </DialogTitle>
              </div>
              <DialogDescription>
                Event captured at {formatDateTime(selectedLog.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Event Attributes */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <div>
                  <span className="text-muted-foreground">Actor Account:</span>
                  <p className="font-semibold text-foreground">
                    {selectedLog.actorUser?.email || "SYSTEM"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor Role:</span>
                  <p className="font-semibold text-foreground">
                    {selectedLog.actorUser?.role || "SYSTEM"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Entity:</span>
                  <p className="font-semibold text-foreground">
                    {selectedLog.entityType} ({selectedLog.entityId || "N/A"})
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client IP:</span>
                  <p className="font-mono text-foreground">
                    {selectedLog.ipAddress || "Internal"}
                  </p>
                </div>
              </div>

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div>
                  <span className="font-semibold text-muted-foreground">
                    User Agent:
                  </span>
                  <p className="mt-1 break-all rounded bg-muted p-2 font-mono text-[11px] text-muted-foreground">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              {/* Sanitized Metadata JSON */}
              <div>
                <span className="font-semibold text-muted-foreground">
                  Sanitized Metadata Payload:
                </span>
                <pre className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-muted/70 p-3 font-mono text-[11px] text-foreground">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="default" size="sm">
                    Close
                  </Button>
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
