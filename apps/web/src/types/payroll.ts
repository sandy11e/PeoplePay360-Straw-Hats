export type PayrunStatus = "DRAFT" | "CALCULATED" | "VALIDATED" | "CANCELLED"

export interface PayrunRecord {
  id: string
  code: string
  periodStart: string
  periodEnd: string
  status: PayrunStatus
  employeeCount: number
  totalGross: string | null
  totalDeductions: string | null
  totalNet: string | null
  calculatedAt?: string | null
  validatedAt?: string | null
  createdAt: string
  createdByUser?: {
    id: string
    email: string
    role: string
  }
  validatedByUser?: {
    id: string
    email: string
    role: string
  } | null
  _count?: {
    items: number
  }
}

export interface PayrunSummary {
  id: string
  code: string
  periodStart: string
  periodEnd: string
  status: PayrunStatus
}

export interface PayrunListResponse {
  payruns: PayrunRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface PayrunCalculationLineItem {
  ruleId?: string
  code: string
  name: string
  category: "EARNING" | "DEDUCTION"
  baseAmount: string
  rateOrPercentage: string
  amount: string
  sequence: number
  isTaxable: boolean
}

export interface PayrunCalculationItem {
  id: string
  payrunId: string
  employeeId: string
  baseSalary: string
  grossAmount: string
  deductionAmount: string
  netAmount: string
  warningCount: number
  warnings?: Array<{ code: string; message: string; severity: "LOW" | "MEDIUM" | "HIGH" }>
  lineItems?: PayrunCalculationLineItem[]
  calculatedAt: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
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
}

export interface PayrunDetailsResponse {
  payrun: PayrunRecord & {
    items?: PayrunCalculationItem[]
  }
}
