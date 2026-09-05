import {
  NavLink,
  Outlet,
} from "react-router-dom"

import { Button } from "@/components/ui/button"

import { useAuth } from "@/auth/auth-context"

const navigation = [
  {
    label: "Dashboard",
    to: "/",
  },
  {
    label: "Employees",
    to: "/employees",
  },
  {
    label: "Departments",
    to: "/departments",
  },
  {
    label: "Job Positions",
    to: "/job-positions",
  },
]

export function AppLayout() {
  const {
    user,
    logout,
  } = useAuth()

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 w-64 border-r bg-background p-5">
        <div className="mb-8">
          <h1 className="text-xl font-bold">
            PeoplePay360
          </h1>

          <p className="text-sm text-muted-foreground">
            HR & Payroll
          </p>
        </div>

        <nav className="space-y-1">
          {navigation.map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({
                  isActive,
                }) =>
                  [
                    "block rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          <div className="mb-3 text-sm">
            <p className="truncate font-medium">
              {user?.email}
            </p>

            <p className="text-muted-foreground">
              {user?.role}
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              void logout()
            }}
          >
            Logout
          </Button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  )
}