export type PaymentStatus = "UNPAID" | "PROCESSING" | "PAID" | "FAILED"
export type PayslipStatus = "DRAFT" | "FINAL"

export interface PayslipLine {
  id: string
  payslipId: string
  salaryRuleCode: string
  salaryRuleName: string
  category: "EARNING" | "DEDUCTION"
  amount: string
  sequence: number
  createdAt?: string
}

export interface PayslipEmployeeSummary {
  id: string
  userId?: string | null
  employeeCode: string
  firstName: string
  middleName?: string | null
  lastName: string
  workEmail: string
  department?: {
    id: string
    name: string
  } | null
  jobPosition?: {
    id: string
    title: string
  } | null
}

export interface PayslipPayrunSummary {
  id: string
  code: string
  status: string
  periodStart: string
  periodEnd: string
}

export interface Payslip {
  id: string
  payslipNumber: string
  payrunId: string
  employeeId: string
  periodStart: string
  periodEnd: string
  baseSalary: string
  grossAmount: string
  totalDeductions: string
  netAmount: string
  status: PayslipStatus
  paymentStatus: PaymentStatus
  generatedAt?: string
  createdAt: string
  updatedAt: string
  lines?: PayslipLine[]
  employee: PayslipEmployeeSummary
  payrun?: PayslipPayrunSummary
  _count?: {
    lines: number
  }
}

export interface PayslipListResponse {
  payrun?: PayslipPayrunSummary
  data: Payslip[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface MyPayslipsResponse {
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
  }
  data: Payslip[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
