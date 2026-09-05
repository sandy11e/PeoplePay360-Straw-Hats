import { describe, expect, it } from "vitest"
import {
  canManageAttendance,
  canManageEmployees,
  canManageLeave,
  canManagePayroll,
  canManageUsers,
  isAdmin,
  isEmployee,
  isHr,
  isPayroll,
  isPayrollManager,
  isSelfServiceOnly,
} from "./roles"

describe("Role Predicate Utilities", () => {
  describe("isAdmin", () => {
    it("returns true only for ADMIN", () => {
      expect(isAdmin("ADMIN")).toBe(true)
      expect(isAdmin("HR_MANAGER")).toBe(false)
      expect(isAdmin("PAYROLL_MANAGER")).toBe(false)
      expect(isAdmin("EMPLOYEE")).toBe(false)
      expect(isAdmin(undefined)).toBe(false)
    })
  })

  describe("isHr", () => {
    it("returns true for ADMIN and HR_MANAGER", () => {
      expect(isHr("ADMIN")).toBe(true)
      expect(isHr("HR_MANAGER")).toBe(true)
      expect(isHr("PAYROLL_MANAGER")).toBe(false)
      expect(isHr("EMPLOYEE")).toBe(false)
    })
  })

  describe("isPayroll", () => {
    it("returns true for ADMIN, PAYROLL_MANAGER, and PAYROLL_USER", () => {
      expect(isPayroll("ADMIN")).toBe(true)
      expect(isPayroll("PAYROLL_MANAGER")).toBe(true)
      expect(isPayroll("PAYROLL_USER")).toBe(true)
      expect(isPayroll("HR_MANAGER")).toBe(false)
      expect(isPayroll("EMPLOYEE")).toBe(false)
    })
  })

  describe("isEmployee", () => {
    it("returns true for EMPLOYEE role only", () => {
      expect(isEmployee("EMPLOYEE")).toBe(true)
      expect(isEmployee("ADMIN")).toBe(false)
      expect(isEmployee("HR_MANAGER")).toBe(false)
    })
  })

  describe("isPayrollManager", () => {
    it("returns true for ADMIN and PAYROLL_MANAGER only", () => {
      expect(isPayrollManager("ADMIN")).toBe(true)
      expect(isPayrollManager("PAYROLL_MANAGER")).toBe(true)
      expect(isPayrollManager("PAYROLL_USER")).toBe(false)
      expect(isPayrollManager("EMPLOYEE")).toBe(false)
    })
  })

  describe("isSelfServiceOnly", () => {
    it("returns true strictly for EMPLOYEE", () => {
      expect(isSelfServiceOnly("EMPLOYEE")).toBe(true)
      expect(isSelfServiceOnly("ADMIN")).toBe(false)
      expect(isSelfServiceOnly("HR_MANAGER")).toBe(false)
      expect(isSelfServiceOnly("PAYROLL_MANAGER")).toBe(false)
    })
  })

  describe("Permission gates", () => {
    it("canManageUsers is strictly ADMIN", () => {
      expect(canManageUsers("ADMIN")).toBe(true)
      expect(canManageUsers("HR_MANAGER")).toBe(false)
      expect(canManageUsers("PAYROLL_MANAGER")).toBe(false)
      expect(canManageUsers("EMPLOYEE")).toBe(false)
    })

    it("canManageEmployees requires HR or Admin", () => {
      expect(canManageEmployees("ADMIN")).toBe(true)
      expect(canManageEmployees("HR_MANAGER")).toBe(true)
      expect(canManageEmployees("EMPLOYEE")).toBe(false)
    })

    it("canManagePayroll requires Payroll Manager or Admin", () => {
      expect(canManagePayroll("ADMIN")).toBe(true)
      expect(canManagePayroll("PAYROLL_MANAGER")).toBe(true)
      expect(canManagePayroll("PAYROLL_USER")).toBe(false)
      expect(canManagePayroll("EMPLOYEE")).toBe(false)
    })

    it("canManageAttendance & canManageLeave require HR or Admin", () => {
      expect(canManageAttendance("HR_MANAGER")).toBe(true)
      expect(canManageAttendance("EMPLOYEE")).toBe(false)
      expect(canManageLeave("HR_MANAGER")).toBe(true)
      expect(canManageLeave("EMPLOYEE")).toBe(false)
    })
  })
})
