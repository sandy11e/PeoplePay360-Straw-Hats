import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { ShieldXIcon } from "lucide-react"

import { useAuth } from "./auth-context"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types/auth"

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/20">
        <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">
          Authenticating PeoplePay360 session...
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in-50">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
          <ShieldXIcon className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          Access Restricted
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your role (<span className="font-semibold text-foreground">{user.role}</span>) does not have permission to access this module. If you believe this is an error, please contact your system administrator.
        </p>
        <div className="mt-6">
          <Button render={<Link to="/" />}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
