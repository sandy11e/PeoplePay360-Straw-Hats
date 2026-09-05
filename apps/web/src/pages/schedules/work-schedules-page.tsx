import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PlusIcon,
  UserPlusIcon,
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
import { formatMinutes } from "@/utils/format"
import { isHr } from "@/utils/roles"

type DayName =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"

interface DayConfig {
  dayOfWeek: DayName
  isWorkingDay: boolean
  startTime: string
  endTime: string
  breakMinutes: number
}

interface ScheduleDayRecord {
  id: string
  dayOfWeek: DayName
  isWorkingDay: boolean
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  expectedMinutes: number
}

interface WorkScheduleRecord {
  id: string
  code: string
  name: string
  timezone: string
  isActive: boolean
  days: ScheduleDayRecord[]
  createdAt: string
}

interface WorkScheduleListResponse {
  schedules: WorkScheduleRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const DEFAULT_DAYS: DayConfig[] = [
  { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
  { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
  { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
  { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
  { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
  { dayOfWeek: "SATURDAY", isWorkingDay: false, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
  { dayOfWeek: "SUNDAY", isWorkingDay: false, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
]

export function WorkSchedulesPage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [schedules, setSchedules] = useState<WorkScheduleRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create Schedule Dialog
  const [createScheduleOpen, setCreateScheduleOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [days, setDays] = useState<DayConfig[]>(DEFAULT_DAYS)
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false)

  // Assign Schedule Dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignEmployeeId, setAssignEmployeeId] = useState("")
  const [assignScheduleId, setAssignScheduleId] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const res = await request<WorkScheduleListResponse>("/work-schedules?page=1&pageSize=50")
      setSchedules(res.schedules)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load work schedules")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await request<EmployeeListResponse>("/employees?page=1&pageSize=100")
      setEmployees(res.employees)
    } catch (err) {
      console.error("Failed to load employees for schedule assignment", err)
    }
  }, [request])

  useEffect(() => {
    void fetchSchedules()
    if (canManage) {
      void fetchEmployees()
    }
  }, [canManage, fetchEmployees, fetchSchedules])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateModal() {
    setCode(`SCH-${Date.now().toString().slice(-4)}`)
    setName("")
    setTimezone("UTC")
    setDays(DEFAULT_DAYS)
    setCreateScheduleOpen(true)
  }

  function openAssignModal(scheduleId?: string) {
    setAssignEmployeeId(employees[0]?.id || "")
    setAssignScheduleId(scheduleId || schedules[0]?.id || "")
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
    setEffectiveTo("")
    setAssignOpen(true)
  }

  function handleDayChange(index: number, updates: Partial<DayConfig>) {
    setDays((prev) => {
      const next = [...prev]
      next[index] = { ...next[index]!, ...updates }
      return next
    })
  }

  async function handleCreateSchedule(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    try {
      setIsCreatingSchedule(true)

      const payloadDays = days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isWorkingDay: d.isWorkingDay,
        startTime: d.isWorkingDay ? d.startTime : null,
        endTime: d.isWorkingDay ? d.endTime : null,
        breakMinutes: d.isWorkingDay ? d.breakMinutes : 0,
      }))

      await request("/work-schedules", {
        method: "POST",
        body: {
          code: code.trim().toUpperCase(),
          name,
          timezone,
          isActive: true,
          days: payloadDays,
        },
      })

      setSuccessMessage(`Work schedule "${name}" (${code}) created successfully`)
      setCreateScheduleOpen(false)
      void fetchSchedules()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create work schedule")
    } finally {
      setIsCreatingSchedule(false)
    }
  }

  async function handleAssignSchedule(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!assignEmployeeId || !assignScheduleId) {
      setErrorMessage("Employee and schedule selection are required")
      return
    }

    try {
      setIsAssigning(true)
      await request("/work-schedules/assignments", {
        method: "POST",
        body: {
          employeeId: assignEmployeeId,
          scheduleId: assignScheduleId,
          effectiveFrom,
          effectiveTo: effectiveTo ? effectiveTo : null,
        },
      })

      setSuccessMessage("Schedule assigned to employee successfully")
      setAssignOpen(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to assign schedule")
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Work Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Weekly working patterns, day-of-week shift hours, and employee shift assignments.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openAssignModal()} className="gap-2 shadow-xs">
              <UserPlusIcon className="size-4" />
              <span>Assign Schedule</span>
            </Button>
            <Button onClick={openCreateModal} className="gap-2 shadow-xs">
              <PlusIcon className="size-4" />
              <span>Create Schedule</span>
            </Button>
          </div>
        )}
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
          <CardTitle className="text-base font-semibold">Configured Schedules</CardTitle>
          <CardDescription>
            {schedules.length} weekly work schedule pattern{schedules.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Schedule Name</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Total Weekly Hours</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={canManage ? 7 : 6} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="h-48">
                      <EmptyState
                        title="No work schedules created"
                        description="Define weekly schedules to enforce working hours and calculate attendance."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((s) => {
                    const workingDaysCount = s.days.filter((d) => d.isWorkingDay).length
                    const totalWeeklyMinutes = s.days.reduce(
                      (sum, d) => sum + (d.expectedMinutes || 0),
                      0,
                    )

                    return (
                      <TableRow key={s.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {s.code}
                        </TableCell>

                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.timezone}
                        </TableCell>

                        <TableCell className="text-sm">
                          {workingDaysCount} day{workingDaysCount === 1 ? "" : "s"} / week
                        </TableCell>

                        <TableCell className="font-semibold text-foreground">
                          {formatMinutes(totalWeeklyMinutes)}
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={s.isActive ? "ACTIVE" : "INACTIVE"}
                            category="general"
                          />
                        </TableCell>

                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAssignModal(s.id)}
                              className="h-8 gap-1.5 px-2 text-xs"
                            >
                              <UserPlusIcon className="size-3.5" />
                              <span>Assign</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE WORK SCHEDULE MODAL (WEEKLY 7-DAY EDITOR) */}
      <Dialog open={createScheduleOpen} onOpenChange={setCreateScheduleOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Weekly Work Schedule</DialogTitle>
            <DialogDescription>
              Configure standard shift hours and break durations for every weekday.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSchedule} className="space-y-5 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sch-code">Schedule Code</Label>
                <Input
                  id="sch-code"
                  required
                  placeholder="e.g. STD-40"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sch-name">Schedule Name</Label>
                <Input
                  id="sch-name"
                  required
                  placeholder="e.g. Standard 40 Hours (Mon - Fri)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Weekly Days Editor */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Weekday Configuration
              </Label>

              <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/20">
                {days.map((day, idx) => (
                  <div
                    key={day.dayOfWeek}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-lg bg-card border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-2.5 w-32">
                      <input
                        type="checkbox"
                        id={`day-${day.dayOfWeek}`}
                        checked={day.isWorkingDay}
                        onChange={(e) => handleDayChange(idx, { isWorkingDay: e.target.checked })}
                        className="size-4 rounded-sm border-input text-primary"
                      />
                      <label htmlFor={`day-${day.dayOfWeek}`} className="font-semibold cursor-pointer">
                        {day.dayOfWeek}
                      </label>
                    </div>

                    {day.isWorkingDay ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Start:</span>
                          <input
                            type="time"
                            required
                            value={day.startTime}
                            onChange={(e) => handleDayChange(idx, { startTime: e.target.value })}
                            className="rounded border border-input bg-background px-1.5 py-1 text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">End:</span>
                          <input
                            type="time"
                            required
                            value={day.endTime}
                            onChange={(e) => handleDayChange(idx, { endTime: e.target.value })}
                            className="rounded border border-input bg-background px-1.5 py-1 text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Break:</span>
                          <input
                            type="number"
                            min="0"
                            max="240"
                            value={day.breakMinutes}
                            onChange={(e) =>
                              handleDayChange(idx, { breakMinutes: parseInt(e.target.value) || 0 })
                            }
                            className="w-14 rounded border border-input bg-background px-1.5 py-1 text-xs text-center"
                          />
                          <span className="text-muted-foreground">m</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Off Day / Non-Working</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreatingSchedule} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreatingSchedule}>
                {isCreatingSchedule ? "Creating..." : "Create Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ASSIGN SCHEDULE MODAL */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Work Schedule</DialogTitle>
            <DialogDescription>
              Associate an employee with a weekly schedule and define the effective dates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssignSchedule} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-emp">Employee</Label>
              <select
                id="as-emp"
                required
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
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
              <Label htmlFor="as-sch">Work Schedule</Label>
              <select
                id="as-sch"
                required
                value={assignScheduleId}
                onChange={(e) => setAssignScheduleId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Schedule</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-from">Effective From</Label>
                <Input
                  id="as-from"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="as-to">Effective To (Optional)</Label>
                <Input
                  id="as-to"
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isAssigning} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isAssigning}>
                {isAssigning ? "Assigning..." : "Save Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
