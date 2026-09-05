import type { UserRole } from "@/types/auth"

export const ROLES = {
  ADMIN: "ADMIN",
  HR_MANAGER: "HR_MANAGER",
  PAYROLL_MANAGER: "PAYROLL_MANAGER",
  PAYROLL_USER: "PAYROLL_USER",
  EMPLOYEE: "EMPLOYEE",
} as const

export const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "HR_MANAGER",
  "PAYROLL_MANAGER",
  "PAYROLL_USER",
  "EMPLOYEE",
]

export const HR_ROLES: UserRole[] = ["ADMIN", "HR_MANAGER"]
export const PAYROLL_ROLES: UserRole[] = ["ADMIN", "PAYROLL_MANAGER", "PAYROLL_USER"]
export const PAYROLL_MANAGE_ROLES: UserRole[] = ["ADMIN", "PAYROLL_MANAGER"]
export const ADMIN_ONLY_ROLES: UserRole[] = ["ADMIN"]

export function hasRole(userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false
  return allowedRoles.includes(userRole)
}

export function isAdmin(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN"
}

export function isHr(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "HR_MANAGER"
}

export function isPayroll(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "PAYROLL_MANAGER" || userRole === "PAYROLL_USER"
}

export function isPayrollManager(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "PAYROLL_MANAGER"
}

export function isEmployee(userRole: UserRole | undefined): boolean {
  return userRole === "EMPLOYEE"
}

export function isSelfServiceOnly(userRole: UserRole | undefined): boolean {
  return userRole === "EMPLOYEE"
}

export function canManageUsers(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN"
}

export function canManageEmployees(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "HR_MANAGER"
}

export function canManagePayroll(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "PAYROLL_MANAGER"
}

export function canManageAttendance(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "HR_MANAGER"
}

export function canManageLeave(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "HR_MANAGER"
}
