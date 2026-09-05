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
        <div className="flex h-16 items-center border-b border-border/80 px-5 bg-gradient-to-r from-primary/[0.03] to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 text-white shadow-[0_4px_16px_-2px_rgba(59,73,223,0.4)] ring-2 ring-primary/30 transition-transform hover:scale-105 animate-gradient-flow">
              <CoinsIcon className="size-5 drop-shadow-xs animate-pulse-glow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold tracking-tight text-foreground">PeoplePay</h1>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary uppercase tracking-wider animate-pulse">360</span>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">HR & Payroll Suite</p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-6 px-3 py-4" aria-label="Main Navigation">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h2 className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </h2>
              <div className="mt-1 space-y-0.5">
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
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-gradient-to-r from-primary/15 via-primary/8 to-transparent text-primary font-semibold border-l-[3px] border-primary shadow-2xs pl-2.5"
                            : "text-muted-foreground/90 hover:bg-muted/60 hover:text-foreground hover:translate-x-0.5",
                        ].join(" ")
                      }
                    >
                      <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Profile & Status Widget */}
      <div className="border-t border-border/80 p-3 bg-muted/20">
        <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{user?.email || "User"}</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2 shrink-0 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{user?.role?.replace(/_/g, " ") || "Active"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
