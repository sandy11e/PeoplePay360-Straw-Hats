import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileSpreadsheetIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { BulkImportDialog } from "./bulk-import-dialog"
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
import type { Department, Employee, EmployeeListResponse, JobPosition } from "@/types/hr"
import { formatDate } from "@/utils/format"
import { isHr } from "@/utils/roles"

interface DepartmentsResponse {
  departments: Department[]
}

interface JobPositionsResponse {
  jobPositions: JobPosition[]
}

export function EmployeesPage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([])

  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create Employee Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Bulk Import Dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  // Form Fields
  const [code, setCode] = useState("")
  const [firstName, setFirstName] = useState("")
  const [middleName, setMiddleName] = useState("")
  const [lastName, setLastName] = useState("")
  const [workEmail, setWorkEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10))
  const [departmentId, setDepartmentId] = useState("")
  const [jobPositionId, setJobPositionId] = useState("")
  const [managerId, setManagerId] = useState("")

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      let url = `/employees?page=${page}&pageSize=${pageSize}`
      if (departmentFilter !== "ALL") {
        url += `&departmentId=${departmentFilter}`
      }
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`
      }

      const result = await request<EmployeeListResponse>(url)
      setEmployees(result.employees)
      setTotalPages(result.pagination.totalPages)
      setTotalCount(result.pagination.total)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load employees")
    } finally {
      setIsLoading(false)
    }
  }, [departmentFilter, page, pageSize, request, statusFilter])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, posRes] = await Promise.all([
        request<DepartmentsResponse>("/departments"),
        request<JobPositionsResponse>("/job-positions"),
      ])
      setDepartments(deptRes.departments.filter((d) => d.isActive))
      setJobPositions(posRes.jobPositions.filter((p) => p.isActive))
    } catch (err) {
      console.error("Failed to load reference data", err)
    }
  }, [request])

  useEffect(() => {
    void fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    if (canManage) {
      void fetchReferenceData()
    }
  }, [canManage, fetchReferenceData])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateDialog() {
    setCode("")
    setFirstName("")
    setMiddleName("")
    setLastName("")
    setWorkEmail("")
    setPhone("")
    setJoiningDate(new Date().toISOString().slice(0, 10))
    setDepartmentId(departments[0]?.id || "")
    setJobPositionId(jobPositions[0]?.id || "")
    setManagerId("")
    setDialogOpen(true)
  }

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    try {
      setIsCreating(true)
      await request("/employees", {
        method: "POST",
        body: {
          employeeCode: code,
          firstName,
          middleName: middleName || null,
          lastName,
          workEmail,
          phone: phone || null,
          joiningDate: new Date(joiningDate).toISOString(),
          departmentId,
          jobPositionId,
          managerId: managerId || null,
        },
      })

      setSuccessMessage(`Employee ${firstName} ${lastName} (${code}) created successfully`)
      setDialogOpen(false)
      void fetchEmployees()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create employee")
    } finally {
      setIsCreating(false)
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const query = searchTerm.toLowerCase()
    return (
      emp.employeeCode.toLowerCase().includes(query) ||
      emp.firstName.toLowerCase().includes(query) ||
      emp.lastName.toLowerCase().includes(query) ||
      emp.workEmail.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Employee Directory</h1>
          <p className="text-sm text-muted-foreground">
            View profiles, contracts, schedules, and personnel records across your organization.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
              className="gap-2 shadow-xs cursor-pointer border-primary/20 hover:bg-primary/5 text-primary"
            >
              <FileSpreadsheetIcon className="size-4" />
              <span>Import Excel</span>
            </Button>

            <Button onClick={openCreateDialog} className="gap-2 shadow-xs cursor-pointer">
              <PlusIcon className="size-4" />
              <span>Add Employee</span>
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

      {/* Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Active Personnel</CardTitle>
              <CardDescription>
                {totalCount} employee record{totalCount === 1 ? "" : "s"} found
              </CardDescription>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search code, name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="NOTICE_PERIOD">Notice Period</option>
                <option value="RESIGNED">Resigned</option>
                <option value="TERMINATED">Terminated</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <EmptyState
                        title="No employees found"
                        description={
                          searchTerm || departmentFilter !== "ALL" || statusFilter !== "ALL"
                            ? "No employee records match the active filters."
                            : "No employees registered yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {emp.employeeCode}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {emp.firstName} {emp.middleName ? `${emp.middleName} ` : ""}{emp.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{emp.workEmail}</p>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm font-medium text-foreground/90">
                        {emp.department?.name || "—"}
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {emp.jobPosition?.title || "—"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={emp.employmentStatus} category="employment" />
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(emp.joiningDate)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link to={`/employees/${emp.id}`} />}
                          className="h-8 gap-1 px-2 text-xs"
                        >
                          <EyeIcon className="size-3.5" />
                          <span>View</span>
                        </Button>
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

      {/* CREATE EMPLOYEE MODAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enroll New Employee</DialogTitle>
            <DialogDescription>
              Create an organizational profile and link department, designation, and reporting lines.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEmployee} className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-code">Employee Code</Label>
                <Input
                  id="emp-code"
                  required
                  placeholder="e.g. EMP-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-joining">Joining Date</Label>
                <Input
                  id="emp-joining"
                  type="date"
                  required
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-fname">First Name</Label>
                <Input
                  id="emp-fname"
                  required
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-mname">Middle Name (Optional)</Label>
                <Input
                  id="emp-mname"
                  placeholder="A."
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-lname">Last Name</Label>
                <Input
                  id="emp-lname"
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Work Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  required
                  placeholder="john.doe@peoplepay360.local"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-phone">Phone Number (Optional)</Label>
                <Input
                  id="emp-phone"
                  placeholder="+1-555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-dept">Department</Label>
                <select
                  id="emp-dept"
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="emp-position">Job Position</Label>
                <select
                  id="emp-position"
                  required
                  value={jobPositionId}
                  onChange={(e) => setJobPositionId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>Select Job Position</option>
                  {jobPositions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="emp-manager">Reporting Manager (Optional)</Label>
                <select
                  id="emp-manager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No Direct Manager</option>
                  {employees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Enrolling..." : "Enroll Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {canManage && (
        <BulkImportDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          onSuccess={(msg) => {
            setSuccessMessage(msg)
            void fetchEmployees()
          }}
          request={request}
        />
      )}
    </div>
  )
}
