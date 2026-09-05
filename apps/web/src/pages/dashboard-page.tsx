import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { useAuth } from "@/auth/auth-context"

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h2>

        <p className="mt-1 text-muted-foreground">
          Welcome to PeoplePay360.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              Account
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="font-medium">
              {user?.email}
            </p>

            <p className="text-sm text-muted-foreground">
              {user?.role}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Employees
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Employee management is active.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Payroll
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Payroll module coming in a later phase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}