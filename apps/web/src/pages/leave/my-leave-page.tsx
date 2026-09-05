import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PlaneTakeoffIcon,
  XCircleIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
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
import { formatDate } from "@/utils/format"

interface LeaveBalance {
  leaveTypeId: string
  code: string
  name: string
  isPaid: boolean
  year: number
  allocatedDays: number
  usedDays: number
  remainingDays: number
}

interface LeaveBalancesResponse {
  balances: LeaveBalance[]
}

interface LeaveType {
  id: string
  code: string
  name: string
  isPaid: boolean
}

interface LeaveTypesResponse {
  leaveTypes: LeaveType[]
}

interface LeaveRequestItem {
  id: string
  startDate: string
  endDate: string
  requestedDays: number
  reason: string
  status: string
  reviewComment: string | null
  createdAt: string
  leaveType: {
    name: string
    code: string
    isPaid: boolean
  }
}

interface LeaveRequestsResponse {
  leaveRequests: LeaveRequestItem[]
}

export function MyLeavePage() {
  const { request } = useAuth()

  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Request Form Modal
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cancel Request Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [requestToCancel, setRequestToCancel] = useState<LeaveRequestItem | null>(null)

  const loadLeaveData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [balRes, reqRes, typesRes] = await Promise.all([
        request<LeaveBalancesResponse>("/leave-allocations").catch(() => ({ balances: [] })),
        request<LeaveRequestsResponse>("/leave-requests/me").catch(() => ({ leaveRequests: [] })),
        request<LeaveTypesResponse>("/leave-types").catch(() => ({ leaveTypes: [] })),
      ])

      setBalances(balRes.balances)
      setRequests(reqRes.leaveRequests)
      setLeaveTypes(typesRes.leaveTypes.filter((t) => t.isPaid || !t.isPaid))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load leave records")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadLeaveData()
  }, [loadLeaveData])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openRequestModal() {
    setSelectedTypeId(leaveTypes[0]?.id || "")
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate(new Date().toISOString().slice(0, 10))
    setReason("")
    setRequestModalOpen(true)
  }

  async function handleApplyLeave(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedTypeId) {
      setErrorMessage("Please select a leave category")
      return
    }

    try {
      setIsSubmitting(true)
      await request("/leave-requests", {
        method: "POST",
        body: {
          leaveTypeId: selectedTypeId,
          startDate,
          endDate,
          reason,
        },
      })

      setSuccessMessage("Leave application submitted successfully for review")
      setRequestModalOpen(false)
      void loadLeaveData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to apply for leave")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelRequest() {
    if (!requestToCancel) return

    try {
      await request(`/leave-requests/${requestToCancel.id}/cancel`, {
        method: "POST",
      })

      setSuccessMessage("Leave application cancelled successfully")
      void loadLeaveData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel leave request")
    } finally {
      setRequestToCancel(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Leave</h1>
          <p className="text-sm text-muted-foreground">
            View available annual quotas, submit time-off applications, and track approval status.
          </p>
        </div>

        <Button onClick={openRequestModal} className="gap-2 shadow-xs">
          <PlaneTakeoffIcon className="size-4" />
          <span>Request Leave</span>
        </Button>
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

      {/* Quota Balance Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Annual Leave Entitlements
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-28 animate-pulse bg-muted/10" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No leave quota allocations configured for your profile for the current calendar year.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {balances.map((b) => (
              <Card key={b.leaveTypeId} className="shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>{b.name}</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                      {b.year}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{b.remainingDays}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Days Available</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      <p>Used: {b.usedDays} days</p>
                      <p>Quota: {b.allocatedDays} days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Personal Applications History */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">My Leave Applications</CardTitle>
          <CardDescription>Track status and comments for submitted time-off requests</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Category</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Requested Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40">
                      <EmptyState
                        title="No leave requests"
                        description="You haven't submitted any time-off requests yet."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-medium text-foreground">
                        {r.leaveType.name}
                      </TableCell>
                      <TableCell>{formatDate(r.startDate)}</TableCell>
                      <TableCell>{formatDate(r.endDate)}</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {r.requestedDays} day{r.requestedDays === 1 ? "" : "s"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={r.reason}>
                        {r.reason}
                        {r.reviewComment && (
                          <span className="block text-xs italic text-foreground/80 mt-0.5">
                            Note: {r.reviewComment}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} category="leave" />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRequestToCancel(r)
                              setCancelModalOpen(true)
                            }}
                            className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-500/10"
                          >
                            <XCircleIcon className="size-3.5" />
                            <span>Cancel</span>
                          </Button>
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

      {/* REQUEST LEAVE MODAL */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Leave Request</DialogTitle>
            <DialogDescription>
              Specify time-off dates and reasons for managerial review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplyLeave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-type">Leave Category</Label>
              <select
                id="req-type"
                required
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Leave Type</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.isPaid ? "Paid" : "Unpaid"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-start">Start Date</Label>
                <Input
                  id="req-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-end">End Date</Label>
                <Input
                  id="req-end"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req-reason">Reason</Label>
              <Input
                id="req-reason"
                required
                placeholder="Brief reason for time-off..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isSubmitting} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Apply for Leave"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CANCEL CONFIRMATION */}
      <ConfirmDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Leave Request"
        description="Are you sure you want to withdraw this pending leave request?"
        variant="destructive"
        confirmLabel="Withdraw Request"
        onConfirm={handleCancelRequest}
      />
    </div>
  )
}
