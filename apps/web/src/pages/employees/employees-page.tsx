import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react"

import {
  Link,
} from "react-router-dom"

import { useAuth } from "@/auth/auth-context"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

import type {
  Department,
  EmployeeListResponse,
  JobPosition,
} from "@/types/hr"

interface DepartmentsResponse {
  departments: Department[]
}

interface JobPositionsResponse {
  jobPositions: JobPosition[]
}

export function EmployeesPage() {
  const {
    request,
    user,
  } = useAuth()

  const [
    employees,
    setEmployees,
  ] = useState<
    EmployeeListResponse["employees"]
  >([])

  const [
    departments,
    setDepartments,
  ] = useState<Department[]>([])

  const [
    jobPositions,
    setJobPositions,
  ] = useState<JobPosition[]>([])

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  const [
    employeeCode,
    setEmployeeCode,
  ] = useState("")

  const [
    firstName,
    setFirstName,
  ] = useState("")

  const [
    lastName,
    setLastName,
  ] = useState("")

  const [
    workEmail,
    setWorkEmail,
  ] = useState("")

  const [
    phone,
    setPhone,
  ] = useState("")

  const [
    joiningDate,
    setJoiningDate,
  ] = useState("")

  const [
    departmentId,
    setDepartmentId,
  ] = useState("")

  const [
    jobPositionId,
    setJobPositionId,
  ] = useState("")

  const [
    error,
    setError,
  ] = useState("")

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "HR_MANAGER"

  const loadEmployees =
    useCallback(
      async (page: number) => {
        try {
          setError("")

          const result =
            await request<EmployeeListResponse>(
              `/employees?page=${page}&pageSize=10`,
            )

          setEmployees(
            result.employees,
          )

          setPagination(
            result.pagination,
          )
        } catch (caughtError) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load employees",
          )
        }
      },
      [request],
    )

  const loadReferences =
    useCallback(async () => {
      try {
        const [
          departmentResult,
          positionResult,
        ] = await Promise.all([
          request<DepartmentsResponse>(
            "/departments",
          ),

          request<JobPositionsResponse>(
            "/job-positions",
          ),
        ])

        setDepartments(
          departmentResult.departments.filter(
            (department) =>
              department.isActive,
          ),
        )

        setJobPositions(
          positionResult.jobPositions.filter(
            (position) =>
              position.isActive,
          ),
        )
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load employee form data",
        )
      }
    }, [request])

  useEffect(() => {
    void loadEmployees(1)
    void loadReferences()
  }, [
    loadEmployees,
    loadReferences,
  ])

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault()

    setError("")
    setIsSubmitting(true)

    try {
      await request(
        "/employees",
        {
          method: "POST",

          body: {
            employeeCode,
            firstName,
            lastName,
            workEmail,
            joiningDate,
            departmentId,
            jobPositionId,

            ...(phone
              ? {
                  phone,
                }
              : {}),
          },
        },
      )

      setEmployeeCode("")
      setFirstName("")
      setLastName("")
      setWorkEmail("")
      setPhone("")
      setJoiningDate("")
      setDepartmentId("")
      setJobPositionId("")

      await loadEmployees(1)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create employee",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Employees
        </h2>

        <p className="mt-1 text-muted-foreground">
          Manage PeoplePay360 employee records.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Add Employee
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            >
              <div className="space-y-2">
                <Label>
                  Employee Code
                </Label>

                <Input
                  value={employeeCode}
                  onChange={(event) =>
                    setEmployeeCode(
                      event.target.value,
                    )
                  }
                  placeholder="EMP002"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  First Name
                </Label>

                <Input
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Last Name
                </Label>

                <Input
                  value={lastName}
                  onChange={(event) =>
                    setLastName(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Work Email
                </Label>

                <Input
                  type="email"
                  value={workEmail}
                  onChange={(event) =>
                    setWorkEmail(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Phone
                </Label>

                <Input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Joining Date
                </Label>

                <Input
                  type="date"
                  value={joiningDate}
                  onChange={(event) =>
                    setJoiningDate(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Department
                </Label>

                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={departmentId}
                  onChange={(event) =>
                    setDepartmentId(
                      event.target.value,
                    )
                  }
                  required
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={
                          department.id
                        }
                        value={
                          department.id
                        }
                      >
                        {
                          department.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label>
                  Job Position
                </Label>

                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={jobPositionId}
                  onChange={(event) =>
                    setJobPositionId(
                      event.target.value,
                    )
                  }
                  required
                >
                  <option value="">
                    Select position
                  </option>

                  {jobPositions.map(
                    (position) => (
                      <option
                        key={
                          position.id
                        }
                        value={
                          position.id
                        }
                      >
                        {
                          position.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="lg:col-span-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Creating..."
                    : "Create Employee"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Employee Directory
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  Code
                </TableHead>

                <TableHead>
                  Employee
                </TableHead>

                <TableHead>
                  Department
                </TableHead>

                <TableHead>
                  Position
                </TableHead>

                <TableHead>
                  Status
                </TableHead>

                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {employees.map(
                (employee) => (
                  <TableRow
                    key={employee.id}
                  >
                    <TableCell className="font-medium">
                      {
                        employee.employeeCode
                      }
                    </TableCell>

                    <TableCell>
                      {employee.firstName}{" "}
                      {employee.lastName}

                      <div className="text-xs text-muted-foreground">
                        {
                          employee.workEmail
                        }
                      </div>
                    </TableCell>

                    <TableCell>
                      {
                        employee.department
                          .name
                      }
                    </TableCell>

                    <TableCell>
                      {
                        employee.jobPosition
                          .title
                      }
                    </TableCell>

                    <TableCell>
                      {
                        employee.employmentStatus
                      }
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
  variant="outline"
  size="sm"
  render={
    <Link to={`/employees/${employee.id}`} />
  }
>
  View
</Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pagination.total} employee(s)
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={
                  pagination.page <= 1
                }
                onClick={() =>
                  void loadEmployees(
                    pagination.page -
                      1,
                  )
                }
              >
                Previous
              </Button>

              <Button
                variant="outline"
                disabled={
                  pagination.page >=
                  pagination.totalPages
                }
                onClick={() =>
                  void loadEmployees(
                    pagination.page +
                      1,
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
