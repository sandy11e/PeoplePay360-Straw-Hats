import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react"

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
} from "@/types/hr"

interface DepartmentResponse {
  departments: Department[]
}

interface CreateDepartmentResponse {
  department: Department
}

export function DepartmentsPage() {
  const {
    request,
    user,
  } = useAuth()

  const [
    departments,
    setDepartments,
  ] = useState<Department[]>([])

  const [code, setCode] =
    useState("")

  const [name, setName] =
    useState("")

  const [
    description,
    setDescription,
  ] = useState("")

  const [
    error,
    setError,
  ] = useState("")

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "HR_MANAGER"

  const loadDepartments =
    useCallback(async () => {
      try {
        setError("")

        const result =
          await request<DepartmentResponse>(
            "/departments",
          )

        setDepartments(
          result.departments,
        )
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load departments",
        )
      } finally {
        setIsLoading(false)
      }
    }, [request])

  useEffect(() => {
    void loadDepartments()
  }, [loadDepartments])

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault()

    setError("")
    setIsSubmitting(true)

    try {
      await request<CreateDepartmentResponse>(
        "/departments",
        {
          method: "POST",

          body: {
            code,
            name,
            ...(description
              ? {
                  description,
                }
              : {}),
          },
        },
      )

      setCode("")
      setName("")
      setDescription("")

      await loadDepartments()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create department",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Departments
        </h2>

        <p className="mt-1 text-muted-foreground">
          Manage company departments.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Create Department
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-3"
            >
              <div className="space-y-2">
                <Label htmlFor="department-code">
                  Code
                </Label>

                <Input
                  id="department-code"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value,
                    )
                  }
                  placeholder="ENG"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department-name">
                  Name
                </Label>

                <Input
                  id="department-name"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="Engineering"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department-description">
                  Description
                </Label>

                <Input
                  id="department-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="md:col-span-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Creating..."
                    : "Create Department"}
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
            Department List
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">
              Loading...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Code
                  </TableHead>

                  <TableHead>
                    Name
                  </TableHead>

                  <TableHead>
                    Description
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {departments.map(
                  (department) => (
                    <TableRow
                      key={
                        department.id
                      }
                    >
                      <TableCell className="font-medium">
                        {
                          department.code
                        }
                      </TableCell>

                      <TableCell>
                        {
                          department.name
                        }
                      </TableCell>

                      <TableCell>
                        {department.description ??
                          "—"}
                      </TableCell>

                      <TableCell>
                        {department.isActive
                          ? "Active"
                          : "Inactive"}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}