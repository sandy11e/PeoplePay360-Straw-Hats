import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  FileCheckIcon,
  RefreshCwIcon,
  UsersIcon,
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
import type { RoleAwareDashboardResponse } from "@/types/dashboard"
import { formatDate, formatMinutes, formatMoney } from "@/utils/format"

export function DashboardPage() {
  const { request, user } = useAuth()

  const [dashboardData, setDashboardData] =
    useState<RoleAwareDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Active view tab for Admin (who has both HR & Payroll)
  const [adminTab, setAdminTab] = useState<"hr" | "payroll">("hr")

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await request<{ data: RoleAwareDashboardResponse }>(
        "/dashboard",
      )
      setDashboardData(res.data)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to load dashboard metrics.")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 py-8 text-center">
        <AlertCircleIcon className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">
          Dashboard Unavailable
        </h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => void loadDashboard()}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const role = user?.role || "EMPLOYEE"
  const hr = dashboardData?.hr
  const payroll = dashboardData?.payroll
  const me = dashboardData?.me

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {role === "EMPLOYEE"
              ? `Welcome back, ${me?.profile.firstName || user?.email}`
              : "Enterprise Operations Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role === "ADMIN" &&
              "System administrator command center: real-time HR headcount, operational metrics & payroll health."}
            {role === "HR_MANAGER" &&
              "HR operational metrics: headcount, shift attendance, and pending leave approvals."}
            {(role === "PAYROLL_MANAGER" || role === "PAYROLL_USER") &&
              "Payroll intelligence: payrun statuses, disbursement totals, and warning audits."}
            {role === "EMPLOYEE" &&
              "Your self-service hub: attendance records, leave quotas, and compensation history."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Tab Switcher */}
          {role === "ADMIN" && (
            <div className="flex rounded-md border border-border bg-muted p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setAdminTab("hr")}
                className={`rounded px-3 py-1 transition-colors ${
                  adminTab === "hr"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                HR Overview
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("payroll")}
                className={`rounded px-3 py-1 transition-colors ${
                  adminTab === "payroll"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Payroll & Finance
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadDashboard()}
            title="Refresh dashboard data"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EMPLOYEE SELF-SERVICE DASHBOARD                                        */}
      {/* ========================================================================= */}
      {role === "EMPLOYEE" && me && (
        <div className="space-y-6">
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Shift Clock Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Today's Attendance
                </CardTitle>
                <ClockIcon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {me.attendanceSummary.today ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        {me.attendanceSummary.today.checkInAt
                          ? new Date(
                              me.attendanceSummary.today.checkInAt,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                      <StatusBadge
                        status={me.attendanceSummary.today.status}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Worked:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMinutes(me.attendanceSummary.today.workedMinutes)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-amber-600">
                      Not Checked In
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No shift activity recorded today.
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    render={<Link to="/my-attendance" />}
                  >
                    Open Punch Clock
                    <ArrowRightIcon className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Leave Balance Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Annual Leave Quota
                </CardTitle>
                <CalendarDaysIcon className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                {me.leaveSummary.balances.length > 0 ? (
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {me.leaveSummary.balances[0].remainingDays}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        days left
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {me.leaveSummary.balances[0].usedDays} used of{" "}
                      {me.leaveSummary.balances[0].allocatedDays} allocated
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      No Allocations
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No leave quota assigned yet.
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    render={<Link to="/my-leave" />}
                  >
                    Request Leave
                    <ArrowRightIcon className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Latest Payslip Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Latest Compensation
                </CardTitle>
                <CoinsIcon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                {me.latestPayslip ? (
                  <div>
                    <div className="font-mono text-xl font-bold text-emerald-600">
                      {formatMoney(me.latestPayslip.netAmount)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Net Take-Home •{" "}
                      <span className="font-medium">
                        {formatDate(me.latestPayslip.periodEnd)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      No Payslips Yet
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Statements will appear upon payroll finalization.
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    render={<Link to="/my-payslips" />}
                  >
                    View All Payslips
                    <ArrowRightIcon className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Profile Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Employment
                </CardTitle>
                <BriefcaseIcon className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold text-foreground">
                  {me.profile.jobPosition?.title || "Staff Member"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {me.profile.department?.name || "General"}
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    render={<Link to="/my-profile" />}
                  >
                    View Profile
                    <ArrowRightIcon className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Split: Leave Balances & Recent Requests */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* All Leave Type Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Leave Quotas & Balances
                </CardTitle>
                <CardDescription>
                  Your current active calendar year allocations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {me.leaveSummary.balances.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No leave allocations have been assigned for this year.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {me.leaveSummary.balances.map((b) => {
                      const percentage =
                        b.allocatedDays > 0
                          ? Math.min(
                              100,
                              Math.round((b.usedDays / b.allocatedDays) * 100),
                            )
                          : 0
                      return (
                        <div key={b.leaveTypeId} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">
                              {b.name} ({b.code})
                            </span>
                            <span className="text-muted-foreground">
                              <strong className="text-foreground">
                                {b.remainingDays}
                              </strong>{" "}
                              remaining of {b.allocatedDays} d
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Leave Requests */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Recent Leave Applications
                  </CardTitle>
                  <CardDescription>
                    Status of your submitted requests.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link to="/my-leave" />}
                >
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                {me.leaveSummary.recentRequests.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No recent leave applications on file.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {me.leaveSummary.recentRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between py-2.5 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-foreground">
                            {req.leaveType.name}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDate(req.startDate)} –{" "}
                            {formatDate(req.endDate)} ({req.requestedDays} d)
                          </div>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HR OVERVIEW (ADMIN or HR_MANAGER)                                      */}
      {/* ========================================================================= */}
      {(role === "HR_MANAGER" || (role === "ADMIN" && adminTab === "hr")) &&
        hr && (
          <div className="space-y-6">
            {/* Top KPI Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Headcount */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Headcount
                  </CardTitle>
                  <UsersIcon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {hr.activeEmployees}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hr.totalEmployees} registered across all statuses
                  </p>
                </CardContent>
              </Card>

              {/* Attendance Today */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Attendance Today
                  </CardTitle>
                  <CalendarCheckIcon className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {hr.attendanceToday.PRESENT + hr.attendanceToday.LATE}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hr.attendanceToday.PRESENT} On Time •{" "}
                    {hr.attendanceToday.LATE} Late
                  </p>
                </CardContent>
              </Card>

              {/* On Leave Today */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    On Leave Today
                  </CardTitle>
                  <CalendarDaysIcon className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {hr.employeesOnLeave}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approved leaves in active window
                  </p>
                </CardContent>
              </Card>

              {/* Pending Approvals */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pending Leave Approvals
                  </CardTitle>
                  <FileCheckIcon className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-foreground">
                      {hr.pendingLeaveRequests}
                    </div>
                    {hr.pendingLeaveRequests > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        render={<Link to="/leave" />}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requires HR Manager action
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Middle Split: Department Distribution & Recent Hires */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Department Distribution */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Department Distribution
                    </CardTitle>
                    <CardDescription>
                      Active headcount breakdown across organization units.
                    </CardDescription>
                  </div>
                  <Building2Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {hr.departmentCounts.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No departments configured.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {hr.departmentCounts.map((dept) => {
                        const pct =
                          hr.activeEmployees > 0
                            ? Math.round(
                                (dept.activeEmployeeCount /
                                  hr.activeEmployees) *
                                  100,
                              )
                            : 0
                        return (
                          <div key={dept.departmentId} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {dept.name}
                              </span>
                              <span className="text-muted-foreground">
                                {dept.activeEmployeeCount} staff ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Employees */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Recent Additions
                    </CardTitle>
                    <CardDescription>
                      Newest staff members registered in the system.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/employees" />}
                  >
                    Directory
                  </Button>
                </CardHeader>
                <CardContent>
                  {hr.recentEmployees.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No recent employee records.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {hr.recentEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between py-2.5 text-xs"
                        >
                          <div>
                            <Link
                              to={`/employees/${emp.id}`}
                              className="font-semibold text-foreground hover:underline"
                            >
                              {emp.firstName} {emp.lastName}
                            </Link>
                            <div className="text-muted-foreground">
                              {emp.employeeCode} •{" "}
                              {emp.department?.name || "General"} •{" "}
                              {emp.jobPosition?.title || "Staff"}
                            </div>
                          </div>
                          <span className="text-muted-foreground">
                            Joined {formatDate(emp.joiningDate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      {/* ========================================================================= */}
      {/* 3. PAYROLL & FINANCE OVERVIEW (ADMIN or PAYROLL roles)                    */}
      {/* ========================================================================= */}
      {(role === "PAYROLL_MANAGER" ||
        role === "PAYROLL_USER" ||
        (role === "ADMIN" && adminTab === "payroll")) &&
        payroll && (
          <div className="space-y-6">
            {/* Top Financial KPI Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Gross Payroll */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cumulative Gross Pay
                  </CardTitle>
                  <CoinsIcon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl font-bold text-foreground">
                    {formatMoney(payroll.grossPayroll)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All validated payrun cycles
                  </p>
                </CardContent>
              </Card>

              {/* Total Deductions */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Deductions
                  </CardTitle>
                  <FileCheckIcon className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl font-bold text-rose-600">
                    -{formatMoney(payroll.totalDeductions)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Taxes, PF, and statutory withholdings
                  </p>
                </CardContent>
              </Card>

              {/* Net Disbursed */}
              <Card className="border-emerald-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Net Take-Home
                  </CardTitle>
                  <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(payroll.netPayroll)}
                  </div>
                  <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                    Final settled employee pay
                  </p>
                </CardContent>
              </Card>

              {/* Unpaid Payslips */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Unpaid Payslips
                  </CardTitle>
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-amber-600">
                      {payroll.unpaidPayslipsCount}
                    </div>
                    {payroll.unpaidPayslipsCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        render={<Link to="/payslips" />}
                      >
                        Disburse
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Awaiting bank transfer settlement
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Latest Payrun Card & Warnings Split */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Latest Payrun Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Current Payroll Cycle
                    </CardTitle>
                    <CardDescription>
                      Latest scheduled payrun and validation state.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/payruns" />}
                  >
                    All Cycles
                  </Button>
                </CardHeader>
                <CardContent>
                  {payroll.latestPayrun ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div>
                          <div className="font-mono text-base font-bold text-foreground">
                            {payroll.latestPayrun.code}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(payroll.latestPayrun.periodStart)} –{" "}
                            {formatDate(payroll.latestPayrun.periodEnd)}
                          </div>
                        </div>
                        <StatusBadge status={payroll.latestPayrun.status} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded bg-muted p-2">
                          <div className="text-muted-foreground">Employees</div>
                          <div className="font-bold text-foreground">
                            {payroll.latestPayrun.employeeCount}
                          </div>
                        </div>
                        <div className="rounded bg-muted p-2">
                          <div className="text-muted-foreground">Gross Pay</div>
                          <div className="font-mono font-semibold text-foreground">
                            {formatMoney(payroll.latestPayrun.totalGross)}
                          </div>
                        </div>
                        <div className="rounded bg-muted p-2">
                          <div className="text-muted-foreground">Net Pay</div>
                          <div className="font-mono font-bold text-emerald-600">
                            {formatMoney(payroll.latestPayrun.totalNet)}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          render={
                            <Link to={`/payruns/${payroll.latestPayrun.id}`} />
                          }
                        >
                          View Payrun Breakdown & Actions
                          <ArrowRightIcon className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No payroll cycles configured yet.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Payroll Warnings Audit */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Payroll Audit Warnings
                    </CardTitle>
                    <CardDescription>
                      Exceptions flagged during calculation engine run.
                    </CardDescription>
                  </div>
                  <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {payroll.recentPayrollWarnings.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <CheckCircle2Icon className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                      Clean payroll engine run. Zero warnings detected.
                    </div>
                  ) : (
                    <div className="max-h-64 divide-y divide-border overflow-y-auto">
                      {payroll.recentPayrollWarnings.map((w) => (
                        <div key={w.id} className="py-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {w.employee.firstName} {w.employee.lastName} (
                              {w.employee.employeeCode})
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {w.payrun.code}
                            </span>
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {w.warnings.map((warn, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-1 text-amber-600 dark:text-amber-400"
                              >
                                <span className="font-mono font-semibold">
                                  [{warn.code}]
                                </span>{" "}
                                <span>{warn.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  )
}