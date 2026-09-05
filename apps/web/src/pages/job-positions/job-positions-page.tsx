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
  JobPosition,
} from "@/types/hr"

interface JobPositionResponse {
  jobPositions: JobPosition[]
}

export function JobPositionsPage() {
  const {
    request,
    user,
  } = useAuth()

  const [
    positions,
    setPositions,
  ] = useState<JobPosition[]>([])

  const [code, setCode] =
    useState("")

  const [title, setTitle] =
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

  const loadPositions =
    useCallback(async () => {
      try {
        setError("")

        const result =
          await request<JobPositionResponse>(
            "/job-positions",
          )

        setPositions(
          result.jobPositions,
        )
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load job positions",
        )
      } finally {
        setIsLoading(false)
      }
    }, [request])

  useEffect(() => {
    void loadPositions()
  }, [loadPositions])

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault()

    setError("")
    setIsSubmitting(true)

    try {
      await request(
        "/job-positions",
        {
          method: "POST",

          body: {
            code,
            title,
            ...(description
              ? {
                  description,
                }
              : {}),
          },
        },
      )

      setCode("")
      setTitle("")
      setDescription("")

      await loadPositions()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create job position",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Job Positions
        </h2>

        <p className="mt-1 text-muted-foreground">
          Manage positions available within the organisation.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Create Job Position
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-3"
            >
              <div className="space-y-2">
                <Label>
                  Code
                </Label>

                <Input
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value,
                    )
                  }
                  placeholder="SWE"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Title
                </Label>

                <Input
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value,
                    )
                  }
                  placeholder="Software Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Description
                </Label>

                <Input
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
                    : "Create Job Position"}
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
            Job Position List
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Code
                  </TableHead>
                  <TableHead>
                    Title
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
                {positions.map(
                  (position) => (
                    <TableRow
                      key={position.id}
                    >
                      <TableCell className="font-medium">
                        {position.code}
                      </TableCell>

                      <TableCell>
                        {position.title}
                      </TableCell>

                      <TableCell>
                        {position.description ??
                          "—"}
                      </TableCell>

                      <TableCell>
                        {position.isActive
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