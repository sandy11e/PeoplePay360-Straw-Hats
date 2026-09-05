import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BadgePercentIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  MailIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UserIcon,
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
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Employee, EmploymentStatus } from "@/types/hr"
import { formatDate, formatDateTime, formatMinutes, formatMoney } from "@/utils/format"
import { isHr } from "@/utils/roles"

interface EmployeeResponse {
  employee: Employee
}

interface ContractItem {
  id: string
  contractNumber: string
  startDate: string
  endDate: string | null
  baseSalary: string
  currency: string
  status: string
}

interface ContractsResponse {
  contracts: ContractItem[]
}

interface ScheduleAssignment {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  schedule: {
    id: string
    code: string
    name: string
    timezone: string
  }
}

interface ScheduleAssignmentsResponse {
  assignments: ScheduleAssignment[]
}

interface AttendanceItem {
  id: string
  attendanceDate: string
  checkInAt: string
  checkOutAt: string | null
  workedMinutes: number | null
  status: string
  source: string
}

interface AttendanceResponse {
  attendances: AttendanceItem[]
}

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

interface LeaveRequestItem {
  id: string
  startDate: string
  endDate: string
  requestedDays: number
  reason: string
  status: string
  leaveType: {
    name: string
  }
}

interface LeaveRequestsResponse {
  leaveRequests: LeaveRequestItem[]
}

interface SalaryStructureAssignment {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  salaryStructure: {
    id: string
    code: string
    name: string
  }
}

interface SalaryAssignmentsResponse {
  assignments: SalaryStructureAssignment[]
}

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "ACTIVE",
  "ON_LEAVE",
  "NOTICE_PERIOD",
  "RESIGNED",
  "TERMINATED",
  "INACTIVE",
]

type ActiveTab = "overview" | "contracts" | "schedules" | "attendance" | "leave" | "salary"

export function EmployeeDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Status Modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState<EmploymentStatus>("ACTIVE")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Sub-resource data states
  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [schedules, setSchedules] = useState<ScheduleAssignment[]>([])
  const [attendances, setAttendances] = useState<AttendanceItem[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [salaryAssignments, setSalaryAssignments] = useState<SalaryStructureAssignment[]>([])

  const [tabLoading, setTabLoading] = useState(false)

  const loadEmployee = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const res = await request<EmployeeResponse>(`/employees/${id}`)
      setEmployee(res.employee)
      setTargetStatus(res.employee.employmentStatus)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load employee")
    } finally {
      setIsLoading(false)
    }
  }, [id, request])

  useEffect(() => {
    void loadEmployee()
  }, [loadEmployee])

  // Lazy load sub-resource data when switching tabs
  useEffect(() => {
    if (!id) return

    async function loadTabData() {
      try {
        setTabLoading(true)

        if (activeTab === "contracts") {
          const res = await request<ContractsResponse>(`/contracts?employeeId=${id}`)
          setContracts(res.contracts)
        } else if (activeTab === "schedules") {
          const res = await request<ScheduleAssignmentsResponse>(
            `/work-schedules/assignments/employee/${id}`,
          )
          setSchedules(res.assignments)
        } else if (activeTab === "attendance") {
          const res = await request<AttendanceResponse>(`/attendance/employee/${id}`)
          setAttendances(res.attendances)
        } else if (activeTab === "leave") {
          const [balRes, reqRes] = await Promise.all([
            request<LeaveBalancesResponse>(`/leave-allocations/employee/${id}`).catch(() => ({
              balances: [],
            })),
            request<LeaveRequestsResponse>(`/leave-requests?employeeId=${id}`).catch(() => ({
              leaveRequests: [],
            })),
          ])
          setLeaveBalances(balRes.balances)
          setLeaveRequests(reqRes.leaveRequests)
        } else if (activeTab === "salary") {
          const res = await request<SalaryAssignmentsResponse>(
            `/employees/${id}/salary-structures`,
          ).catch(() => ({ assignments: [] }))
          setSalaryAssignments(res.assignments)
        }
      } catch (err) {
        console.error(`Failed to load ${activeTab} data`, err)
      } finally {
        setTabLoading(false)
      }
    }

    if (activeTab !== "overview") {
      void loadTabData()
    }
  }, [activeTab, id, request])

  async function handleStatusUpdate() {
    if (!id) return
    try {
      setIsUpdatingStatus(true)
      await request(`/employees/${id}/status`, {
        method: "PATCH",
        body: { status: targetStatus },
      })
      setSuccessMessage(`Employment status changed to ${targetStatus}`)
      setStatusModalOpen(false)
      void loadEmployee()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update employment status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading employee profile...</p>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" render={<Link to="/employees" />}>
          <ArrowLeftIcon className="mr-2 size-4" /> Back to Employees
        </Button>
        <EmptyState title="Employee not found" description="The requested profile does not exist or has been removed." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/employees" />} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          <span>Back to Employee Directory</span>
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

      {/* Profile Banner */}
      <Card className="shadow-xs overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/15 via-primary/5 to-muted/40" />
        <CardContent className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10">
            {/* Avatar and Name */}
            <div className="flex items-end gap-4">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-card border-4 border-background shadow-md text-primary font-bold text-2xl">
                {employee.firstName.charAt(0)}
                {employee.lastName.charAt(0)}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ""}{employee.lastName}
                  </h1>
                  <StatusBadge status={employee.employmentStatus} category="employment" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">
                  {employee.jobPosition?.title || "Designation Pending"} • {employee.department?.name || "No Department"}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusModalOpen(true)}
                  className="gap-1.5"
                >
                  <ShieldCheckIcon className="size-3.5" />
                  <span>Update Status</span>
                </Button>
              </div>
            )}
          </div>

          {/* Key Facts Bar */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Employee Code</p>
              <p className="font-mono text-sm font-semibold text-foreground">{employee.employeeCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Work Email</p>
              <p className="text-sm font-medium text-foreground truncate">{employee.workEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joining Date</p>
              <p className="text-sm font-medium text-foreground">{formatDate(employee.joiningDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Direct Manager</p>
              <p className="text-sm font-medium text-foreground">
                {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "None"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {[
            { id: "overview", label: "Overview", icon: UserIcon },
            { id: "contracts", label: "Contracts", icon: FileTextIcon },
            { id: "schedules", label: "Work Schedules", icon: CalendarClockIcon },
            { id: "attendance", label: "Attendance", icon: ClockIcon },
            { id: "leave", label: "Leave & Balances", icon: CalendarDaysIcon },
            { id: "salary", label: "Salary Structures", icon: BadgePercentIcon },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* TAB CONTENT PANELS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Contact & Personal Details */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Contact & Personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MailIcon className="size-4" /> Work Email
                </span>
                <span className="font-medium text-foreground">{employee.workEmail}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <PhoneIcon className="size-4" /> Phone Number
                </span>
                <span className="font-medium text-foreground">{employee.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDaysIcon className="size-4" /> Date of Joining
                </span>
                <span className="font-medium text-foreground">{formatDate(employee.joiningDate)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Organizational Assignment */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Organizational Unit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2Icon className="size-4" /> Department
                </span>
                <span className="font-medium text-foreground">
                  {employee.department?.name} ({employee.department?.code})
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <UserCheckIcon className="size-4" /> Position
                </span>
                <span className="font-medium text-foreground">{employee.jobPosition?.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <UserIcon className="size-4" /> Reporting Manager
                </span>
                <span className="font-medium text-foreground">
                  {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "None"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CONTRACTS TAB */}
      {activeTab === "contracts" && (
        <Card className="shadow-xs">
          <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Employment Contracts</CardTitle>
              <CardDescription>Wage terms, effective dates, and contract history</CardDescription>
            </div>
            {canManage && (
              <Button size="sm" render={<Link to="/contracts" />} className="gap-1 text-xs">
                <span>Manage Contracts</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {tabLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading contracts...</div>
            ) : contracts.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No contracts on file"
                  description="No contract records have been registered for this employee yet."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Contract #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-semibold">{c.contractNumber}</TableCell>
                      <TableCell>{formatDate(c.startDate)}</TableCell>
                      <TableCell>{formatDate(c.endDate)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(c.baseSalary, c.currency)}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} category="contract" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. SCHEDULES TAB */}
      {activeTab === "schedules" && (
        <Card className="shadow-xs">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Work Schedule Assignments</CardTitle>
            <CardDescription>Weekly work patterns and expected working hours</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tabLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading schedule assignments...</div>
            ) : schedules.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No schedule assigned"
                  description="No weekly work schedule assignment has been configured for this employee."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Schedule Name</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.schedule.name} ({s.schedule.code})</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.schedule.timezone}</TableCell>
                      <TableCell>{formatDate(s.effectiveFrom)}</TableCell>
                      <TableCell>{formatDate(s.effectiveTo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <Card className="shadow-xs">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Recent Attendance Punches</CardTitle>
            <CardDescription>Daily check-in, check-out events, and calculated work duration</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tabLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading attendance history...</div>
            ) : attendances.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No attendance records"
                  description="No check-in or manual attendance records found for this employee."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Worked Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{formatDate(a.attendanceDate)}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(a.checkInAt)}</TableCell>
                      <TableCell className="text-sm">{a.checkOutAt ? formatDateTime(a.checkOutAt) : "Open Session"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatMinutes(a.workedMinutes)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} category="attendance" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. LEAVE TAB */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          {/* Quota Balances */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Annual Leave Balances</h3>
            {leaveBalances.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No leave allocations configured for current year.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {leaveBalances.map((b) => (
                  <Card key={b.leaveTypeId} className="shadow-xs">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span>{b.name}</span>
                        {b.isPaid ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 rounded px-1.5 py-0.5 font-normal">
                            Paid
                          </span>
                        ) : (
                          <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-normal">
                            Unpaid
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-2xl font-bold text-foreground">{b.remainingDays}</p>
                          <p className="text-xs text-muted-foreground">Days Available</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Used: {b.usedDays}</p>
                          <p>Allocated: {b.allocatedDays}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Request History */}
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-semibold">Leave Request History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaveRequests.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No leave requests submitted yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.leaveType.name}</TableCell>
                        <TableCell>{formatDate(r.startDate)}</TableCell>
                        <TableCell>{formatDate(r.endDate)}</TableCell>
                        <TableCell>{r.requestedDays} day{r.requestedDays === 1 ? "" : "s"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.reason}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} category="leave" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. SALARY TAB */}
      {activeTab === "salary" && (
        <Card className="shadow-xs">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Salary Structure Assignments</CardTitle>
            <CardDescription>Assigned compensation rule profiles for payroll calculations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tabLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading salary assignments...</div>
            ) : salaryAssignments.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No salary structure assigned"
                  description="No salary structure has been linked to this employee."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Structure Code</TableHead>
                    <TableHead>Structure Name</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryAssignments.map((sa) => (
                    <TableRow key={sa.id}>
                      <TableCell className="font-mono text-xs font-semibold">{sa.salaryStructure.code}</TableCell>
                      <TableCell className="font-medium">{sa.salaryStructure.name}</TableCell>
                      <TableCell>{formatDate(sa.effectiveFrom)}</TableCell>
                      <TableCell>{formatDate(sa.effectiveTo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* UPDATE STATUS MODAL */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Employment Status</DialogTitle>
            <DialogDescription>
              Transition status for <span className="font-semibold text-foreground">{employee.firstName} {employee.lastName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-select">Employment Status</Label>
              <select
                id="status-select"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as EmploymentStatus)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" disabled={isUpdatingStatus} />}>
                Cancel
              </DialogClose>
              <Button
                disabled={isUpdatingStatus}
                onClick={() => void handleStatusUpdate()}
              >
                {isUpdatingStatus ? "Updating..." : "Save Status"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}