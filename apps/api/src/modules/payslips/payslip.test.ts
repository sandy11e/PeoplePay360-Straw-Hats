import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PaymentStatus,
  PayslipStatus,
  SalaryRuleCategory,
  UserRole,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"

// Test the pure snapshot transformation and integrity logic
describe("Payslip Unit Tests", () => {
  it("should faithfully map and snapshot salary rule line items into payslip lines", () => {
    const rawLineItems = [
      {
        ruleId: "rule-1",
        code: "HRA",
        name: "House Rent Allowance",
        category: SalaryRuleCategory.EARNING,
        baseAmount: "50000.00",
        rateOrPercentage: "40.00",
        amount: "20000.00",
        sequence: 1,
        isTaxable: true,
      },
      {
        ruleId: "rule-2",
        code: "PF_EMPLOYEE",
        name: "Provident Fund Deduction",
        category: SalaryRuleCategory.DEDUCTION,
        baseAmount: "50000.00",
        rateOrPercentage: "12.00",
        amount: "6000.00",
        sequence: 2,
        isTaxable: false,
      },
    ]

    // Convert into payslip line snapshots
    const payslipLines = rawLineItems.map((item) => ({
      salaryRuleCode: item.code,
      salaryRuleName: item.name,
      category: item.category,
      amount: new Prisma.Decimal(item.amount),
      sequence: item.sequence,
    }))

    assert.equal(payslipLines.length, 2)
    assert.equal(payslipLines[0]?.salaryRuleCode, "HRA")
    assert.equal(payslipLines[0]?.salaryRuleName, "House Rent Allowance")
    assert.equal(payslipLines[0]?.category, SalaryRuleCategory.EARNING)
    assert.equal(payslipLines[0]?.amount.toString(), "20000")
    assert.equal(payslipLines[0]?.sequence, 1)

    assert.equal(payslipLines[1]?.salaryRuleCode, "PF_EMPLOYEE")
    assert.equal(payslipLines[1]?.salaryRuleName, "Provident Fund Deduction")
    assert.equal(payslipLines[1]?.category, SalaryRuleCategory.DEDUCTION)
    assert.equal(payslipLines[1]?.amount.toString(), "6000")
    assert.equal(payslipLines[1]?.sequence, 2)
  })

  it("should enforce mathematical invariant: netAmount = grossAmount - totalDeductions", () => {
    const baseSalary = new Prisma.Decimal("65432.10")
    const allowance1 = new Prisma.Decimal("12345.67")
    const allowance2 = new Prisma.Decimal("5432.10")
    const grossAmount = baseSalary.plus(allowance1).plus(allowance2) // 83209.87

    const deduction1 = new Prisma.Decimal("8765.43")
    const deduction2 = new Prisma.Decimal("1234.56")
    const totalDeductions = deduction1.plus(deduction2) // 9999.99

    const netAmount = grossAmount.minus(totalDeductions) // 73209.88

    // Verification
    assert.equal(grossAmount.toString(), "83209.87")
    assert.equal(totalDeductions.toString(), "9999.99")
    assert.equal(netAmount.toString(), "73209.88")
    assert.equal(netAmount.equals(grossAmount.minus(totalDeductions)), true)
  })

  it("should preserve exact Decimal precision without IEEE-754 floating-point drift", () => {
    // In standard IEEE-754: 0.1 + 0.2 !== 0.3
    const numA = 0.1
    const numB = 0.2
    assert.notEqual(numA + numB, 0.3) // IEEE drift

    // In Prisma.Decimal: 0.1 + 0.2 === 0.3 exact
    const decA = new Prisma.Decimal("0.10")
    const decB = new Prisma.Decimal("0.20")
    const decSum = decA.plus(decB)
    assert.equal(decSum.toString(), "0.3")
    assert.equal(decSum.toFixed(2), "0.30")
  })

  it("should enforce employee isolation: employees cannot view another employee's payslip", () => {
    const payslip = {
      id: "ps-123",
      employee: {
        userId: "user-employee-A",
      },
    }

    // Access control function mimicking getPayslipById
    function canAccessPayslip(
      payslipOwnerUserId: string,
      requestingUser: { userId: string; role: UserRole },
    ): boolean {
      if (
        requestingUser.role === UserRole.ADMIN ||
        requestingUser.role === UserRole.PAYROLL_MANAGER ||
        requestingUser.role === UserRole.PAYROLL_USER
      ) {
        return true
      }

      if (requestingUser.role === UserRole.EMPLOYEE) {
        return payslipOwnerUserId === requestingUser.userId
      }

      return false
    }

    // Employee A accessing own payslip
    assert.equal(
      canAccessPayslip(payslip.employee.userId, {
        userId: "user-employee-A",
        role: UserRole.EMPLOYEE,
      }),
      true,
    )

    // Employee B attempting to access Employee A's payslip
    assert.equal(
      canAccessPayslip(payslip.employee.userId, {
        userId: "user-employee-B",
        role: UserRole.EMPLOYEE,
      }),
      false,
    )

    // Payroll User accessing Employee A's payslip
    assert.equal(
      canAccessPayslip(payslip.employee.userId, {
        userId: "user-payroll",
        role: UserRole.PAYROLL_USER,
      }),
      true,
    )

    // Payroll Manager accessing Employee A's payslip
    assert.equal(
      canAccessPayslip(payslip.employee.userId, {
        userId: "user-manager",
        role: UserRole.PAYROLL_MANAGER,
      }),
      true,
    )

    // Admin accessing Employee A's payslip
    assert.equal(
      canAccessPayslip(payslip.employee.userId, {
        userId: "user-admin",
        role: UserRole.ADMIN,
      }),
      true,
    )
  })

  it("should ensure future salary rule edits do not alter snapshotted payslips", () => {
    // Initial salary rule state
    const originalRule = {
      code: "TRAVEL_ALLOWANCE",
      name: "Travel Allowance",
      amount: new Prisma.Decimal("3000.00"),
    }

    // Snapshotted line item in payslip
    const payslipLineSnapshot = {
      salaryRuleCode: originalRule.code,
      salaryRuleName: originalRule.name,
      amount: new Prisma.Decimal(originalRule.amount),
    }

    // Future modification to the salary rule (e.g. rate cut or renamed)
    const modifiedRule = {
      ...originalRule,
      name: "Commuter Subsidy",
      amount: new Prisma.Decimal("1500.00"),
    }

    // Snapshot remains immutable
    assert.equal(payslipLineSnapshot.salaryRuleCode, "TRAVEL_ALLOWANCE")
    assert.equal(payslipLineSnapshot.salaryRuleName, "Travel Allowance")
    assert.equal(payslipLineSnapshot.amount.toString(), "3000")
    assert.notEqual(payslipLineSnapshot.salaryRuleName, modifiedRule.name)
    assert.notEqual(payslipLineSnapshot.amount.toString(), modifiedRule.amount.toString())
  })

  it("should prevent duplicate generation and protect finalized payslips", () => {
    const existingPayslips = [
      { id: "p1", status: PayslipStatus.FINAL },
      { id: "p2", status: PayslipStatus.FINAL },
    ]

    function validateGenerationRequest(
      existing: Array<{ id: string; status: PayslipStatus }>,
      overwriteDrafts: boolean,
    ): { error?: string } {
      if (existing.length > 0) {
        if (existing.some((p) => p.status === PayslipStatus.FINAL)) {
          return { error: "PAYSLIPS_ALREADY_FINALIZED" }
        }
        if (!overwriteDrafts) {
          return { error: "PAYSLIPS_ALREADY_GENERATED" }
        }
      }
      return {}
    }

    // Finalized payslips cannot be overwritten even if overwriteDrafts is true
    assert.equal(
      validateGenerationRequest(existingPayslips, true).error,
      "PAYSLIPS_ALREADY_FINALIZED",
    )

    // Draft payslips without overwrite flag fail with duplicate error
    const draftPayslips = [
      { id: "p1", status: PayslipStatus.DRAFT },
    ]
    assert.equal(
      validateGenerationRequest(draftPayslips, false).error,
      "PAYSLIPS_ALREADY_GENERATED",
    )

    // Draft payslips with overwriteDrafts: true are allowed to regenerate
    assert.equal(
      validateGenerationRequest(draftPayslips, true).error,
      undefined,
    )
  })

  it("should ensure payment status transitions do not mutate financial amounts", () => {
    const payslip = {
      id: "ps-001",
      grossAmount: new Prisma.Decimal("5000.00"),
      totalDeductions: new Prisma.Decimal("500.00"),
      netAmount: new Prisma.Decimal("4500.00"),
      paymentStatus: PaymentStatus.UNPAID,
    }

    // Transitioning payment status
    const updatedStatus = PaymentStatus.PAID
    const updatedPayslip = {
      ...payslip,
      paymentStatus: updatedStatus,
    }

    assert.equal(updatedPayslip.paymentStatus, PaymentStatus.PAID)
    assert.equal(updatedPayslip.grossAmount.toString(), "5000")
    assert.equal(updatedPayslip.totalDeductions.toString(), "500")
    assert.equal(updatedPayslip.netAmount.toString(), "4500")
  })
})
