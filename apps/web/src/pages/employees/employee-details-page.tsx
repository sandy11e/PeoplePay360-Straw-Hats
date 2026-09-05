import {
  useEffect,
  useState,
} from "react"

import {
  Link,
  useParams,
} from "react-router-dom"

import { useAuth } from "@/auth/auth-context"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type {
  Employee,
} from "@/types/hr"

interface EmployeeResponse {
  employee: Employee
}

export function EmployeeDetailsPage() {
  const { id } =
    useParams<{ id: string }>()

  const { request } =
    useAuth()

  const [
    employee,
    setEmployee,
  ] = useState<Employee | null>(null)

  const [
    error,
    setError,
  ] = useState("")

  useEffect(() => {
    if (!id) {
      return
    }

    async function loadEmployee() {
      try {
        const result =
          await request<EmployeeResponse>(
            `/employees/${id}`,
          )

        setEmployee(
          result.employee,
        )
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load employee",
        )
      }
    }

    void loadEmployee()
  }, [id, request])

  if (error) {
    return (
      <p className="text-destructive">
        {error}
      </p>
    )
  }

  if (!employee) {
    return (
      <p className="text-muted-foreground">
        Loading employee...
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">
            {employee.firstName}{" "}
            {employee.lastName}
          </h2>

          <p className="text-muted-foreground">
            {
              employee.employeeCode
            }
          </p>
        </div>

        <Button
  variant="outline"
  size="sm"
  render={
    <Link to={`/employees/${employee.id}`} />
  }
>
  View
</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Employment
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p>
              <strong>
                Status:
              </strong>{" "}
              {
                employee.employmentStatus
              }
            </p>

            <p>
              <strong>
                Department:
              </strong>{" "}
              {
                employee.department.name
              }
            </p>

            <p>
              <strong>
                Position:
              </strong>{" "}
              {
                employee.jobPosition
                  .title
              }
            </p>

            <p>
              <strong>
                Joining date:
              </strong>{" "}
              {
                employee.joiningDate.split(
                  "T",
                )[0]
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Contact
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p>
              <strong>
                Work email:
              </strong>{" "}
              {employee.workEmail}
            </p>

            <p>
              <strong>
                Phone:
              </strong>{" "}
              {employee.phone ?? "—"}
            </p>

            <p>
              <strong>
                Manager:
              </strong>{" "}
              {employee.manager
                ? `${employee.manager.firstName} ${employee.manager.lastName}`
                : "Not assigned"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}