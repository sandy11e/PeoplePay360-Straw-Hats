import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import {
  calculateEmployeePayroll,
  PayrollRuleInput,
} from "./payroll-engine.service.js"

describe("Payroll Engine Unit Tests", () => {
  it("should calculate fixed earning correctly", () => {
    const baseSalary = new Prisma.Decimal("50000.00")
    const rules: PayrollRuleInput[] = [
      {
        code: "BONUS",
        name: "Fixed Bonus",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("7500.00"),
        percentage: null,
        base: null,
        sequence: 1,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    assert.equal(result.baseSalary.toString(), "50000")
    assert.equal(result.grossAmount.toString(), "57500")
    assert.equal(result.deductionAmount.toString(), "0")
    assert.equal(result.netAmount.toString(), "57500")
    assert.equal(result.lineItems.length, 1)
    assert.equal(result.lineItems[0]?.amount, "7500.00")
  })

  it("should calculate percentage earning based on BASE_SALARY and GROSS_EARNINGS", () => {
    const baseSalary = new Prisma.Decimal("40000.00")
    const rules: PayrollRuleInput[] = [
      {
        code: "HRA",
        name: "House Rent Allowance",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("40.00"),
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 1,
      },
      {
        code: "PERF_BONUS",
        name: "Performance Bonus on Gross",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("10.00"),
        base: SalaryRuleBase.GROSS_EARNINGS,
        sequence: 2,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    // Base: 40000
    // HRA (40% of 40000): 16000 -> Gross becomes 56000
    // PERF_BONUS (10% of 56000): 5600 -> Gross becomes 61600
    assert.equal(result.grossAmount.toString(), "61600")
    assert.equal(result.netAmount.toString(), "61600")
    assert.equal(result.lineItems[0]?.amount, "16000.00")
    assert.equal(result.lineItems[1]?.amount, "5600.00")
  })

  it("should calculate fixed deduction correctly", () => {
    const baseSalary = new Prisma.Decimal("50000.00")
    const rules: PayrollRuleInput[] = [
      {
        code: "PROF_TAX",
        name: "Professional Tax",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("200.00"),
        percentage: null,
        base: null,
        sequence: 1,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    assert.equal(result.grossAmount.toString(), "50000")
    assert.equal(result.deductionAmount.toString(), "200")
    assert.equal(result.netAmount.toString(), "49800")
    assert.equal(result.lineItems[0]?.amount, "200.00")
  })

  it("should calculate percentage deduction based on BASE_SALARY and GROSS_EARNINGS", () => {
    const baseSalary = new Prisma.Decimal("50000.00")
    const rules: PayrollRuleInput[] = [
      {
        code: "SPECIAL",
        name: "Special Allowance",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("10000.00"),
        percentage: null,
        base: null,
        sequence: 1,
      },
      {
        code: "PF",
        name: "Provident Fund (12% of Base)",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("12.00"),
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 2,
      },
      {
        code: "INSURANCE",
        name: "Medical Insurance (2% of Gross)",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("2.00"),
        base: SalaryRuleBase.GROSS_EARNINGS,
        sequence: 3,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    // Gross: 50000 + 10000 = 60000
    // PF: 12% of 50000 = 6000
    // Insurance: 2% of 60000 = 1200
    // Total Deductions = 7200
    // Net = 60000 - 7200 = 52800
    assert.equal(result.grossAmount.toString(), "60000")
    assert.equal(result.deductionAmount.toString(), "7200")
    assert.equal(result.netAmount.toString(), "52800")
    assert.equal(result.lineItems[1]?.amount, "6000.00")
    assert.equal(result.lineItems[2]?.amount, "1200.00")
  })

  it("should always satisfy identity: net = gross - deductions", () => {
    const baseSalary = new Prisma.Decimal("73456.78")
    const rules: PayrollRuleInput[] = [
      {
        code: "HRA",
        name: "HRA",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("43.50"),
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 1,
      },
      {
        code: "BONUS",
        name: "Bonus",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("1234.56"),
        percentage: null,
        base: null,
        sequence: 2,
      },
      {
        code: "TAX",
        name: "Tax Deduction",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        amount: null,
        percentage: new Prisma.Decimal("15.25"),
        base: SalaryRuleBase.GROSS_EARNINGS,
        sequence: 3,
      },
      {
        code: "DEDUCT_FIXED",
        name: "Fixed Deduction",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("456.78"),
        percentage: null,
        base: null,
        sequence: 4,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    const expectedNet = result.grossAmount.minus(result.deductionAmount)
    assert.ok(result.netAmount.equals(expectedNet), "netAmount must equal grossAmount - deductionAmount")
  })

  it("should preserve exact Decimal precision without JavaScript floating-point drift", () => {
    // 0.1 + 0.2 in JS float is 0.30000000000000004
    const baseSalary = new Prisma.Decimal("0.10")
    const rules: PayrollRuleInput[] = [
      {
        code: "EARN_1",
        name: "Earn 1",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: new Prisma.Decimal("0.20"),
        percentage: null,
        base: null,
        sequence: 1,
      },
    ]

    const result = calculateEmployeePayroll(baseSalary, rules)

    // Gross must strictly be 0.30
    assert.equal(result.grossAmount.toString(), "0.3")
    assert.equal(result.grossAmount.toFixed(2), "0.30")
  })

  it("should generate warning and safe fallback for missing contract", () => {
    const warnings = ["MISSING_ACTIVE_CONTRACT: No active employment contract found for this period."]
    const result = calculateEmployeePayroll(0, [], warnings)

    assert.equal(result.baseSalary.toString(), "0")
    assert.equal(result.grossAmount.toString(), "0")
    assert.equal(result.deductionAmount.toString(), "0")
    assert.equal(result.netAmount.toString(), "0")
    assert.equal(result.warningCount, 1)
    assert.ok(result.warnings[0]?.includes("MISSING_ACTIVE_CONTRACT"))
  })

  it("should generate warning and safe fallback for missing salary structure", () => {
    const warnings = ["MISSING_SALARY_STRUCTURE: No salary structure assigned for this period."]
    const result = calculateEmployeePayroll(0, [], warnings)

    assert.equal(result.warningCount, 1)
    assert.ok(result.warnings[0]?.includes("MISSING_SALARY_STRUCTURE"))
  })
})
