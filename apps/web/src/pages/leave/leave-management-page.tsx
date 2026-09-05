import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  CheckIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
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
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Employee, EmployeeListResponse } from "@/types/hr"
import { formatDate } from "@/utils/format"

interface LeaveType {
  id: string
  code: string
  name: string
  isPaid: boolean
  isActive: boolean
}

interface LeaveTypesResponse {
  leaveTypes: LeaveType[]
}

interface LeaveRequestItem {
  id: string
  employeeId: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
  }
  leaveType: {
    id: string
    name: string
    code: string
    isPaid: boolean
  }
  startDate: string
  endDate: string
  requestedDays: number
  reason: string
  status: string
  reviewedByUserId: string | null
  reviewedAt: string | null
  reviewComment: string | null
  createdAt: string
}

interface LeaveRequestsResponse {
  leaveRequests: LeaveRequestItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function LeaveManagementPage() {
  const { request } = useAuth()

  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [statusFilter, setStatusFilter] = useState("PENDING")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Review Dialog
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestItem | null>(null)
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE")
  const [reviewComment, setReviewComment] = useState("")
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)

  // Leave Type Dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [typeCode, setTypeCode] = useState("")
  const [typeName, setTypeName] = useState("")
  const [typeIsPaid, setTypeIsPaid] = useState(true)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [isCreatingType, setIsCreatingType] = useState(false)

  // Leave Allocation Dialog
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [allocEmpId, setAllocEmpId] = useState("")
  const [allocTypeId, setAllocTypeId] = useState("")
  const [allocYear, setAllocYear] = useState(new Date().getUTCFullYear().toString())
  const [allocDays, setAllocDays] = useState("20")
  const [allocError, setAllocError] = useState<string | null>(null)
  const [isAllocating, setIsAllocating] = useState(false)

  const fetchLeaveRequests = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      let url = "/leave-requests?page=1&pageSize=50"
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`
      }

      const res = await request<LeaveRequestsResponse>(url)
      setRequests(res.leaveRequests)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load leave requests")
    } finally {
      setIsLoading(false)
    }
  }, [request, statusFilter])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [typesRes, empRes] = await Promise.all([
        request<LeaveTypesResponse>("/leave-types"),
        request<EmployeeListResponse>("/employees?page=1&pageSize=100"),
      ])
      setLeaveTypes(typesRes.leaveTypes)
      setEmployees(empRes.employees)
    } catch (err) {
      console.error("Failed to load leave reference data", err)
    }
  }, [request])

  useEffect(() => {
    void fetchLeaveRequests()
  }, [fetchLeaveRequests])

  useEffect(() => {
    void fetchReferenceData()
  }, [fetchReferenceData])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openReviewModal(req: LeaveRequestItem, action: "APPROVE" | "REJECT") {
    setSelectedRequest(req)
    setReviewAction(action)
    setReviewComment("")
    setReviewError(null)
    setReviewOpen(true)
  }

  async function handleReviewSubmit() {
    if (!selectedRequest) return

    try {
      setIsReviewing(true)
      setReviewError(null)
      const endpoint =
        reviewAction === "APPROVE"
          ? `/leave-requests/${selectedRequest.id}/approve`
          : `/leave-requests/${selectedRequest.id}/reject`

      await request(endpoint, {
        method: "POST",
        body: {
          comment: reviewComment.trim() || null,
        },
      })

      setSuccessMessage(
        `Leave request for ${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName} was ${reviewAction.toLowerCase()}d`,
      )
      setReviewOpen(false)
      void fetchLeaveRequests()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process review"
      setReviewError(msg)
      setErrorMessage(msg)
    } finally {
      setIsReviewing(false)
    }
  }

  async function handleCreateLeaveType(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsCreatingType(true)
      setTypeError(null)
      await request("/leave-types", {
        method: "POST",
        body: {
          code: typeCode.toUpperCase(),
          name: typeName,
          isPaid: typeIsPaid,
          isActive: true,
        },
      })
      setSuccessMessage(`Leave type "${typeName}" created`)
      setTypeDialogOpen(false)
      setTypeCode("")
      setTypeName("")
      void fetchReferenceData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create leave type"
      setTypeError(msg)
      setErrorMessage(msg)
    } finally {
      setIsCreatingType(false)
    }
  }

  async function handleCreateAllocation(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsAllocating(true)
      setAllocError(null)
      await request("/leave-allocations", {
        method: "POST",
        body: {
          employeeId: allocEmpId,
          leaveTypeId: allocTypeId,
          year: parseInt(allocYear),
          allocatedDays: parseFloat(allocDays),
        },
      })
      setSuccessMessage("Leave quota allocation saved successfully")
      setAllocationOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to allocate leave quota"
      setAllocError(msg)
      setErrorMessage(msg)
    } finally {
      setIsAllocating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">
            Approve personnel time-off requests, manage policy quotas, and define leave types.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAllocEmpId(employees[0]?.id || "")
              setAllocTypeId(leaveTypes[0]?.id || "")
              setAllocationOpen(true)
            }}
            className="gap-2 shadow-xs"
          >
            <CalendarCheckIcon className="size-4" />
            <span>Allocate Quota</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setTypeDialogOpen(true)}
            className="gap-2 shadow-xs"
          >
            <SettingsIcon className="size-4" />
            <span>Leave Types</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in-50">
          <AlertCircleIcon className="size-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400 animate-in fade-in-50">
          <CheckCircle2Icon className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Employee Requests Queue</CardTitle>
              <CardDescription>
                {requests.length} leave application{requests.length === 1 ? "" : "s"} under filter
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="ALL">All Requests</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <EmptyState
                        title="No leave requests"
                        description={
                          statusFilter === "PENDING"
                            ? "All pending leave applications have been processed!"
                            : "No leave applications match this filter."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {r.employee.firstName} {r.employee.lastName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{r.employee.employeeCode}</p>
                      </TableCell>

                      <TableCell className="font-medium">
                        {r.leaveType.name}
                        {r.leaveType.isPaid && (
                          <span className="ml-1.5 rounded-sm bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-600 font-semibold">
                            Paid
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-sm">
                        {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        {r.requestedDays} day{r.requestedDays === 1 ? "" : "s"}
                      </TableCell>

                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={r.reason}>
                        {r.reason}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={r.status} category="leave" />
                      </TableCell>

                      <TableCell className="text-right">
                        {r.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReviewModal(r, "APPROVE")}
                              className="h-7 gap-1 px-2 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              <CheckIcon className="size-3.5" />
                              <span>Approve</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReviewModal(r, "REJECT")}
                              className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-500/10"
                            >
                              <XIcon className="size-3.5" />
                              <span>Reject</span>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {r.reviewedAt ? `Reviewed on ${formatDate(r.reviewedAt)}` : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* REVIEW CONFIRMATION MODAL */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVE" ? "Approve Leave Request" : "Reject Leave Request"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "APPROVE"
                ? `Confirm authorization of ${selectedRequest?.requestedDays} day(s) for ${selectedRequest?.employee.firstName} ${selectedRequest?.employee.lastName}.`
                : `Specify an optional reason for rejecting this leave request.`}
            </DialogDescription>
          </DialogHeader>

          {reviewError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
              <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
              <span>{reviewError}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="review-comment">Reviewer Comment (Optional)</Label>
              <Input
                id="review-comment"
                placeholder="e.g. Approved. Coverage scheduled."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" disabled={isReviewing} />}>
                Cancel
              </DialogClose>
              <Button
                variant={reviewAction === "REJECT" ? "destructive" : "default"}
                disabled={isReviewing}
                onClick={() => void handleReviewSubmit()}
              >
                {isReviewing ? "Processing..." : `Confirm ${reviewAction}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE LEAVE TYPE MODAL */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Define Leave Type</DialogTitle>
            <DialogDescription>Create a new policy category for employee time-off.</DialogDescription>
          </DialogHeader>

          {typeError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
              <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
              <span>{typeError}</span>
            </div>
          )}

          <form onSubmit={handleCreateLeaveType} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="lt-code">Type Code</Label>
              <Input
                id="lt-code"
                required
                placeholder="e.g. ANNUAL, SICK, MAT"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lt-name">Type Name</Label>
              <Input
                id="lt-name"
                required
                placeholder="e.g. Annual Vacation Leave"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="lt-paid"
                checked={typeIsPaid}
                onChange={(e) => setTypeIsPaid(e.target.checked)}
                className="size-4 rounded-sm border border-input text-primary"
              />
              <Label htmlFor="lt-paid" className="cursor-pointer text-sm font-normal">
                Paid Time Off (PTO)
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreatingType} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreatingType}>
                {isCreatingType ? "Creating..." : "Create Type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALLOCATE QUOTA MODAL */}
      <Dialog open={allocationOpen} onOpenChange={setAllocationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Leave Quota</DialogTitle>
            <DialogDescription>
              Grant annual time-off entitlement days to an employee for a specific year.
            </DialogDescription>
          </DialogHeader>

          {allocError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
              <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
              <span>{allocError}</span>
            </div>
          )}

          <form onSubmit={handleCreateAllocation} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="al-emp">Employee</Label>
              <select
                id="al-emp"
                required
                value={allocEmpId}
                onChange={(e) => setAllocEmpId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="al-type">Leave Type</Label>
              <select
                id="al-type"
                required
                value={allocTypeId}
                onChange={(e) => setAllocTypeId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Leave Type</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="al-year">Entitlement Year</Label>
                <Input
                  id="al-year"
                  type="number"
                  required
                  value={allocYear}
                  onChange={(e) => setAllocYear(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="al-days">Allocated Days</Label>
                <Input
                  id="al-days"
                  type="number"
                  step="0.5"
                  required
                  value={allocDays}
                  onChange={(e) => setAllocDays(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isAllocating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isAllocating}>
                {isAllocating ? "Allocating..." : "Save Allocation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
