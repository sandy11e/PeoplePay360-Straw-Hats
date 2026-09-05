import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClockIcon,
  CoinsIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { EmployeeDashboardSummary } from "@/types/dashboard"
import { formatDate } from "@/utils/format"

interface ScheduleDay {
  dayOfWeek: number
  isWorkingDay: boolean
  startTime: string | null
  endTime: string | null
  breakMinutes: number
}

interface AssignedSchedule {
  id: string
  scheduleId: string
  effectiveFrom: string
  effectiveTo: string | null
  schedule: {
    id: string
    code: string
    name: string
    timezone: string
    days: ScheduleDay[]
  }
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export function MyProfilePage() {
  const { request, user } = useAuth()

  const [profileData, setProfileData] =
    useState<EmployeeDashboardSummary | null>(null)
  const [schedules, setSchedules] = useState<AssignedSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Fetch dashboard/me which yields authoritative employee profile
      const dashRes = await request<{ data: EmployeeDashboardSummary }>(
        "/dashboard/me",
      )
      setProfileData(dashRes.data)

      // 2. Fetch assigned schedules if employee ID exists
      if (dashRes.data?.profile?.id) {
        try {
          const schedRes = await request<{
            assignments: AssignedSchedule[]
          }>(
            `/work-schedules/assignments/employee/${dashRes.data.profile.id}`,
          )
          setSchedules(schedRes.assignments || [])
        } catch {
          // Schedules may not be assigned yet
          setSchedules([])
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(
        apiErr.message ||
          "Failed to load your profile details. Ensure your user is linked to an employee record.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 w-full animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="space-y-4 py-8 text-center">
        <AlertCircleIcon className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">
          Profile Not Available
        </h2>
        <p className="text-sm text-muted-foreground">
          {error || "No linked employee record was found for this user account."}
        </p>
        <Button variant="outline" onClick={() => void loadProfile()}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const { profile } = profileData
  const activeScheduleAssignment = schedules.find((s) => !s.effectiveTo)
  const activeSchedule = activeScheduleAssignment?.schedule

  return (
    <div className="space-y-6">
      {/* Profile Header Banner */}
      <Card className="border-border bg-gradient-to-r from-card to-muted/50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {profile.firstName} {profile.middleName || ""}{" "}
                    {profile.lastName}
                  </h1>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    ACTIVE
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono font-medium">
                    {profile.employeeCode}
                  </span>{" "}
                  • {profile.jobPosition?.title || "Staff Member"} •{" "}
                  {profile.department?.name || "General Department"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadProfile()}
            >
              <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/my-attendance"
          className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                  Shift Punch Clock
                </div>
                <div className="text-xs text-muted-foreground">
                  Check-in / check-out records
                </div>
              </div>
            </div>
            <StatusBadge
              status={
                profileData.attendanceSummary.today?.status || "ABSENT"
              }
            />
          </div>
        </Link>

        <Link
          to="/my-leave"
          className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                Leave Management
              </div>
              <div className="text-xs text-muted-foreground">
                {profileData.leaveSummary.balances[0]
                  ? `${profileData.leaveSummary.balances[0].remainingDays} days available`
                  : "View leave quota"}
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/my-payslips"
          className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <CoinsIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                My Payslips
              </div>
              <div className="text-xs text-muted-foreground">
                {profileData.latestPayslip
                  ? `Latest: ${profileData.latestPayslip.payslipNumber}`
                  : "View compensation history"}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal & Work Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Employment Profile
            </CardTitle>
            <CardDescription>
              Official personal and job specifications on record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-md border border-border p-3">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Employee Code
                </span>
                <p className="mt-1 font-mono text-sm font-bold text-foreground">
                  {profile.employeeCode}
                </p>
              </div>

              <div className="rounded-md border border-border p-3">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Date of Joining
                </span>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {formatDate(profile.joiningDate)}
                </p>
              </div>

              <div className="col-span-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Work Email
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {profile.workEmail}
                </p>
              </div>

              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Building2Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Department
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {profile.department?.name || "General"}
                </p>
              </div>

              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Job Position
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {profile.jobPosition?.title || "Staff Member"}
                </p>
              </div>

              <div className="col-span-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Portal Authentication Account
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked to user account:{" "}
                  <span className="font-semibold text-foreground">
                    {user?.email}
                  </span>{" "}
                  ({user?.role})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Work Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Work Schedule & Shift Hours
            </CardTitle>
            <CardDescription>
              Your official assigned shift timetable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSchedule ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md bg-muted p-3 text-xs">
                  <div>
                    <div className="font-bold text-foreground">
                      {activeSchedule.name} ({activeSchedule.code})
                    </div>
                    <div className="text-muted-foreground">
                      Timezone: {activeSchedule.timezone}
                    </div>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">
                    Effective Active
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2 pr-2">Day</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2">Working Hours</th>
                        <th className="py-2 text-right">Break</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeSchedule.days.map((day) => (
                        <tr key={day.dayOfWeek} className="hover:bg-muted/30">
                          <td className="py-2 pr-2 font-medium text-foreground">
                            {DAY_NAMES[day.dayOfWeek] || `Day ${day.dayOfWeek}`}
                          </td>
                          <td className="py-2 pr-2">
                            {day.isWorkingDay ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                                Working
                              </span>
                            ) : (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Off Day
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-2 font-mono text-muted-foreground">
                            {day.isWorkingDay && day.startTime && day.endTime
                              ? `${day.startTime} – ${day.endTime}`
                              : "—"}
                          </td>
                          <td className="py-2 text-right text-muted-foreground">
                            {day.isWorkingDay && day.breakMinutes > 0
                              ? `${day.breakMinutes} min`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <ClockIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                No custom work schedule assigned. Standard company working hours
                apply.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
