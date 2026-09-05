import { NavLink } from "react-router-dom"
import {
  BadgePercentIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ClockIcon,
  CoinsIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  ShieldAlertIcon,
  TimerIcon,
  UserCheckIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import {
  ADMIN_ONLY_ROLES,
  ALL_ROLES,
  HR_ROLES,
  PAYROLL_ROLES,
  hasRole,
  isEmployee,
} from "@/utils/roles"
import type { UserRole } from "@/types/auth"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  allowedRoles: UserRole[]
  end?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboardIcon,
        allowedRoles: ["ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "PAYROLL_USER", "EMPLOYEE"],
        end: true,
      },
    ],
  },
  {
    title: "HR Operations",
    items: [
      {
        label: "Employees",
        to: "/employees",
        icon: UsersIcon,
        allowedRoles: HR_ROLES,
      },
      {
        label: "Departments",
        to: "/departments",
        icon: Building2Icon,
        allowedRoles: HR_ROLES,
      },
      {
        label: "Job Positions",
        to: "/job-positions",
        icon: BriefcaseIcon,
        allowedRoles: HR_ROLES,
      },
      {
        label: "Contracts",
        to: "/contracts",
        icon: FileTextIcon,
        allowedRoles: ["ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "PAYROLL_USER"],
      },
      {
        label: "Work Schedules",
        to: "/work-schedules",
        icon: CalendarClockIcon,
        allowedRoles: HR_ROLES,
      },
      {
        label: "Attendance",
        to: "/attendance",
        icon: ClockIcon,
        allowedRoles: HR_ROLES,
      },
      {
        label: "Leave Management",
        to: "/leave",
        icon: CalendarDaysIcon,
        allowedRoles: HR_ROLES,
      },
    ],
  },
  {
    title: "Payroll & Compensation",
    items: [
      {
        label: "Salary Structures",
        to: "/salary-structures",
        icon: BadgePercentIcon,
        allowedRoles: PAYROLL_ROLES,
      },
      {
        label: "Payruns",
        to: "/payruns",
        icon: CoinsIcon,
        allowedRoles: PAYROLL_ROLES,
      },
      {
        label: "Payslips",
        to: "/payslips",
        icon: ReceiptIcon,
        allowedRoles: PAYROLL_ROLES,
      },
    ],
  },
  {
    title: "My Self-Service",
    items: [
      {
        label: "My Profile",
        to: "/my-profile",
        icon: UserCheckIcon,
        allowedRoles: ALL_ROLES,
      },
      {
        label: "My Attendance",
        to: "/my-attendance",
        icon: TimerIcon,
        allowedRoles: ALL_ROLES,
      },
      {
        label: "My Leave",
        to: "/my-leave",
        icon: CalendarDaysIcon,
        allowedRoles: ALL_ROLES,
      },
      {
        label: "My Payslips",
        to: "/my-payslips",
        icon: WalletIcon,
        allowedRoles: ALL_ROLES,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "User Management",
        to: "/users",
        icon: UserCogIcon,
        allowedRoles: ADMIN_ONLY_ROLES,
      },
      {
        label: "Audit Logs",
        to: "/audit-logs",
        icon: ShieldAlertIcon,
        allowedRoles: ADMIN_ONLY_ROLES,
      },
    ],
  },
]

interface SidebarProps {
  onNavClick?: () => void
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const { user } = useAuth()
  const role = user?.role

  // Filter sections and items based on active role
  const visibleSections = NAV_SECTIONS.map((section) => {
    // If user is pure employee, do not show admin/operational sections
    if (isEmployee(role) && section.title !== "Overview" && section.title !== "My Self-Service") {
      return null
    }

    const visibleItems = section.items.filter((item) => hasRole(role, item.allowedRoles))
    if (visibleItems.length === 0) return null

    return {
      ...section,
      items: visibleItems,
    }
  }).filter(Boolean) as NavSection[]

  return (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      {/* Brand Header */}
      <div>
        <div className="flex h-16 items-center border-b border-border px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <CoinsIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">PeoplePay360</h1>
              <p className="text-xs text-muted-foreground">HR & Payroll Suite</p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-6 px-4 py-5" aria-label="Main Navigation">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {section.title}
              </h2>
              <div className="mt-1.5 space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onNavClick}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        ].join(" ")
                      }
                    >
                      <Icon className="size-4 shrink-0 transition-transform group-hover:scale-105" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Branding Info */}
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80">PeoplePay360 Enterprise</p>
        <p className="mt-0.5">Production Build v1.0.0</p>
      </div>
    </div>
  )
}
