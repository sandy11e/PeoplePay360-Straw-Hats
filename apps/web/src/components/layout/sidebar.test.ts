import { describe, expect, it } from "vitest"
import { NAV_SECTIONS } from "./sidebar"
import type { UserRole } from "@/types/auth"

function getVisibleNavRoutes(role: UserRole): string[] {
  const routes: string[] = []
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.allowedRoles.includes(role)) {
        routes.push(item.to)
      }
    }
  }
  return routes
}

describe("Role-Based Sidebar Navigation", () => {
  it("ADMIN can access administrative, operational, and payroll menus", () => {
    const adminRoutes = getVisibleNavRoutes("ADMIN")
    expect(adminRoutes).toContain("/users")
    expect(adminRoutes).toContain("/audit-logs")
    expect(adminRoutes).toContain("/employees")
    expect(adminRoutes).toContain("/departments")
    expect(adminRoutes).toContain("/contracts")
    expect(adminRoutes).toContain("/payruns")
    expect(adminRoutes).toContain("/salary-structures")
    expect(adminRoutes).toContain("/payslips")
  })

  it("HR_MANAGER cannot access admin-only or payroll-only menus", () => {
    const hrRoutes = getVisibleNavRoutes("HR_MANAGER")
    expect(hrRoutes).toContain("/employees")
    expect(hrRoutes).toContain("/departments")
    expect(hrRoutes).toContain("/job-positions")
    expect(hrRoutes).toContain("/contracts")
    expect(hrRoutes).toContain("/work-schedules")
    expect(hrRoutes).toContain("/attendance")
    expect(hrRoutes).toContain("/leave")

    // Must NOT have users, audit logs, or payroll configuration
    expect(hrRoutes).not.toContain("/users")
    expect(hrRoutes).not.toContain("/audit-logs")
    expect(hrRoutes).not.toContain("/salary-structures")
    expect(hrRoutes).not.toContain("/payruns")
  })

  it("PAYROLL_MANAGER cannot access user administration or audit logs", () => {
    const payrollRoutes = getVisibleNavRoutes("PAYROLL_MANAGER")
    expect(payrollRoutes).toContain("/salary-structures")
    expect(payrollRoutes).toContain("/payruns")
    expect(payrollRoutes).toContain("/payslips")
    expect(payrollRoutes).toContain("/contracts")

    expect(payrollRoutes).not.toContain("/users")
    expect(payrollRoutes).not.toContain("/audit-logs")
    expect(payrollRoutes).not.toContain("/job-positions")
  })

  it("EMPLOYEE has strictly self-service routes only", () => {
    const empRoutes = getVisibleNavRoutes("EMPLOYEE")
    expect(empRoutes).toContain("/")
    expect(empRoutes).toContain("/my-profile")
    expect(empRoutes).toContain("/my-attendance")
    expect(empRoutes).toContain("/my-leave")
    expect(empRoutes).toContain("/my-payslips")

    // Must NOT see operational directories
    expect(empRoutes).not.toContain("/users")
    expect(empRoutes).not.toContain("/audit-logs")
    expect(empRoutes).not.toContain("/employees")
    expect(empRoutes).not.toContain("/departments")
    expect(empRoutes).not.toContain("/job-positions")
    expect(empRoutes).not.toContain("/contracts")
    expect(empRoutes).not.toContain("/work-schedules")
    expect(empRoutes).not.toContain("/attendance")
    expect(empRoutes).not.toContain("/leave")
    expect(empRoutes).not.toContain("/salary-structures")
    expect(empRoutes).not.toContain("/payruns")
    expect(empRoutes).not.toContain("/payslips")
  })
})
