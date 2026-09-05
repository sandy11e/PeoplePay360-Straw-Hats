import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PlusIcon,
  SearchIcon,
  TimerIcon,
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
import { formatDate, formatDateTime, formatMinutes } from "@/utils/format"
import { isHr } from "@/utils/roles"

interface AttendanceRecord {
  id: string
  employeeId: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
  }
  attendanceDate: string
  checkInAt: string
  checkOutAt: string | null
  workedMinutes: number | null
  status: string
  source: string
  notes: string | null
}

interface AttendanceListResponse {
  attendance?: AttendanceRecord[]
  attendances?: AttendanceRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function AttendancePage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Manual Entry Dialog
  const [manualOpen, setManualOpen] = useState(false)
  const [manualEmployeeId, setManualEmployeeId] = useState("")
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [checkInTime, setCheckInTime] = useState("09:00")
  const [checkOutTime, setCheckOutTime] = useState("17:00")
  const [manualStatus, setManualStatus] = useState("PRESENT")
  const [notes, setNotes] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)

  const fetchAttendance = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      let url = `/attendance?page=${page}&pageSize=${pageSize}`
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`
      }

      const res = await request<AttendanceListResponse>(url)
      const records = res.attendance || res.attendances || []
      setAttendances(records)
      setTotalPages(res.pagination?.totalPages ?? 1)
      setTotalCount(res.pagination?.total ?? records.length)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load attendance logs")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, request, statusFilter])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await request<EmployeeListResponse>("/employees?page=1&pageSize=100")
      setEmployees(res.employees)
    } catch (err) {
      console.error("Failed to load employees for manual attendance", err)
    }
  }, [request])

  useEffect(() => {
    void fetchAttendance()
  }, [fetchAttendance])

  useEffect(() => {
    if (canManage) {
      void fetchEmployees()
    }
  }, [canManage, fetchEmployees])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openManualModal() {
    setManualEmployeeId(employees[0]?.id || "")
    setAttendanceDate(new Date().toISOString().slice(0, 10))
    setCheckInTime("09:00")
    setCheckOutTime("17:00")
    setManualStatus("PRESENT")
    setNotes("")
    setManualError(null)
    setManualOpen(true)
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setManualError(null)

    if (!manualEmployeeId) {
      setManualError("Please select an employee")
      return
    }

    try {
      setIsSubmittingManual(true)

      const checkInISO = `${attendanceDate}T${checkInTime}:00.000Z`
      const checkOutISO = checkOutTime ? `${attendanceDate}T${checkOutTime}:00.000Z` : null

      await request("/attendance/manual", {
        method: "POST",
        body: {
          employeeId: manualEmployeeId,
          attendanceDate,
          checkInAt: checkInISO,
          checkOutAt: checkOutISO,
          status: manualStatus,
          notes: notes || null,
        },
      })

      setSuccessMessage("Manual attendance logged successfully")
      setManualOpen(false)
      void fetchAttendance()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to log manual attendance"
      setManualError(msg)
      setErrorMessage(msg)
    } finally {
      setIsSubmittingManual(false)
    }
  }

  const records = Array.isArray(attendances) ? attendances : []
  const filteredAttendances = records.filter((a) => {
    if (!searchTerm.trim()) return true
    const query = searchTerm.toLowerCase()
    const firstName = a.employee?.firstName?.toLowerCase() || ""
    const lastName = a.employee?.lastName?.toLowerCase() || ""
    const code = a.employee?.employeeCode?.toLowerCase() || ""
    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      code.includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance Logs</h1>
          <p className="text-sm text-muted-foreground">
            Daily check-in and check-out tracking, worked hours calculations, and shift monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            render={<Link to="/my-attendance" />}
            className="gap-2 shadow-xs"
          >
            <TimerIcon className="size-4 text-primary" />
            <span>My Punch Clock</span>
          </Button>

          {canManage && (
            <Button onClick={openManualModal} className="gap-2 shadow-xs">
              <PlusIcon className="size-4" />
              <span>Manual Attendance</span>
            </Button>
          )}
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

      {/* Main Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Attendance Records</CardTitle>
              <CardDescription>
                {totalCount} total attendance session{totalCount === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Worked Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredAttendances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <EmptyState
                        title="No attendance records found"
                        description={
                          searchTerm || statusFilter !== "ALL"
                            ? "No attendance records match your filter criteria."
                            : "No employee attendance records logged yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttendances.map((att) => (
                    <TableRow key={att.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-medium text-foreground">
                        {formatDate(att.attendanceDate)}
                      </TableCell>

                      <TableCell>
                        <p className="font-medium text-foreground">
                          {att.employee?.firstName || "Staff"} {att.employee?.lastName || ""}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {att.employee?.employeeCode || "—"}
                        </p>
                      </TableCell>

                      <TableCell className="text-sm">{formatDateTime(att.checkInAt)}</TableCell>

                      <TableCell className="text-sm">
                        {att.checkOutAt ? (
                          formatDateTime(att.checkOutAt)
                        ) : (
                          <span className="font-medium text-amber-600 dark:text-amber-400 italic">
                            Session Open
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {formatMinutes(att.workedMinutes)}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={att.status} category="attendance" />
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">
                          {att.source}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MANUAL ENTRY MODAL */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Manual Attendance</DialogTitle>
            <DialogDescription>
              Record an authoritative attendance event or adjustment on behalf of an employee.
            </DialogDescription>
          </DialogHeader>

          {manualError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
              <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
              <span>{manualError}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="att-emp">Employee</Label>
              <select
                id="att-emp"
                required
                value={manualEmployeeId}
                onChange={(e) => setManualEmployeeId(e.target.value)}
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
              <Label htmlFor="att-date">Attendance Date</Label>
              <Input
                id="att-date"
                type="date"
                required
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="att-in">Check In Time</Label>
                <Input
                  id="att-in"
                  type="time"
                  required
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="att-out">Check Out Time (Optional)</Label>
                <Input
                  id="att-out"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="att-status">Status</Label>
              <select
                id="att-status"
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="ABSENT">ABSENT</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="att-notes">Notes (Optional)</Label>
              <Input
                id="att-notes"
                placeholder="Reason for manual entry or adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isSubmittingManual} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmittingManual}>
                {isSubmittingManual ? "Submitting..." : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
