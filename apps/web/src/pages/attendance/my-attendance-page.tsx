import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  LogInIcon,
  LogOutIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDateTime, formatMinutes } from "@/utils/format"

interface TodayAttendance {
  id: string
  checkInAt: string
  checkOutAt: string | null
  workedMinutes: number | null
  status: string
  source: string
}

interface EmployeeDashboardMeResponse {
  data: {
    todayAttendance: TodayAttendance | null
  }
}

interface AttendanceRecord {
  id: string
  attendanceDate: string
  checkInAt: string
  checkOutAt: string | null
  workedMinutes: number | null
  status: string
  source: string
}

interface AttendanceListResponse {
  attendances: AttendanceRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function MyAttendancePage() {
  const { request } = useAuth()

  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null)
  const [history, setHistory] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPunching, setIsPunching] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadAttendanceState = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [dashRes, listRes] = await Promise.all([
        request<EmployeeDashboardMeResponse>("/dashboard/me").catch(() => null),
        request<AttendanceListResponse>("/attendance?page=1&pageSize=20").catch(() => ({
          attendances: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        })),
      ])

      if (dashRes?.data?.todayAttendance) {
        setTodayAttendance(dashRes.data.todayAttendance)
      } else {
        setTodayAttendance(null)
      }

      setHistory(listRes.attendances)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load attendance state")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadAttendanceState()
  }, [loadAttendanceState])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function handleCheckIn() {
    try {
      setIsPunching(true)
      setErrorMessage(null)
      await request("/attendance/check-in", {
        method: "POST",
        body: { source: "WEB" },
      })
      setSuccessMessage("Check-in recorded successfully! Have a productive day.")
      void loadAttendanceState()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to perform check-in")
    } finally {
      setIsPunching(false)
    }
  }

  async function handleCheckOut() {
    try {
      setIsPunching(true)
      setErrorMessage(null)
      await request("/attendance/check-out", {
        method: "POST",
        body: {},
      })
      setSuccessMessage("Check-out recorded successfully! Worked hours logged.")
      void loadAttendanceState()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to perform check-out")
    } finally {
      setIsPunching(false)
    }
  }

  const isCheckedIn = Boolean(todayAttendance && !todayAttendance.checkOutAt)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Self-service punch clock, real-time daily shift tracking, and personal punch history.
        </p>
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

      {/* Punch Action Card */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              <span>Shift Time Tracker</span>
            </CardTitle>
            <CardDescription>
              {isCheckedIn
                ? "Your shift session is actively running. Check out when your workday concludes."
                : todayAttendance?.checkOutAt
                ? "You have already completed your recorded shift for today."
                : "You have not checked in for today yet."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-xl border border-border bg-muted/20 p-6">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Today's Status
                </p>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <StatusBadge
                    status={isCheckedIn ? "PRESENT" : todayAttendance?.status || "NOT_CHECKED_IN"}
                    category="attendance"
                  />
                  {isCheckedIn && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                      Session Active
                    </span>
                  )}
                </div>
              </div>

              {/* Punch Button */}
              <div>
                {!isCheckedIn ? (
                  <Button
                    size="lg"
                    disabled={isPunching || Boolean(todayAttendance?.checkOutAt)}
                    onClick={() => void handleCheckIn()}
                    className="h-12 px-6 gap-2 text-base font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <LogInIcon className="size-5" />
                    <span>{isPunching ? "Recording..." : "Check In Now"}</span>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={isPunching}
                    onClick={() => void handleCheckOut()}
                    variant="destructive"
                    className="h-12 px-6 gap-2 text-base font-semibold shadow-md"
                  >
                    <LogOutIcon className="size-5" />
                    <span>{isPunching ? "Recording..." : "Check Out Now"}</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Stats Card */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TimerIcon className="size-4 text-primary" />
              <span>Today's Details</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Check In</span>
              <span className="font-medium text-foreground">
                {todayAttendance?.checkInAt ? formatDateTime(todayAttendance.checkInAt) : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Check Out</span>
              <span className="font-medium text-foreground">
                {todayAttendance?.checkOutAt ? formatDateTime(todayAttendance.checkOutAt) : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Calculated Duration</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatMinutes(todayAttendance?.workedMinutes)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History Table */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">My Recent Attendance History</CardTitle>
          <CardDescription>Records of your past daily check-in and check-out events</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-12 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36">
                      <EmptyState
                        title="No attendance history yet"
                        description="Your logged punches will appear here once recorded."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((rec) => (
                    <TableRow key={rec.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-medium text-foreground">
                        {formatDate(rec.attendanceDate)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(rec.checkInAt)}</TableCell>
                      <TableCell className="text-sm">
                        {rec.checkOutAt ? formatDateTime(rec.checkOutAt) : "Session Open"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {formatMinutes(rec.workedMinutes)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rec.status} category="attendance" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rec.source}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
