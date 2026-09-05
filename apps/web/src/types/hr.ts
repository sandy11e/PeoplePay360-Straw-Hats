export interface Department {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface JobPosition {
  id: string
  code: string
  title: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type EmploymentStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "NOTICE_PERIOD"
  | "RESIGNED"
  | "TERMINATED"
  | "INACTIVE"

export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  middleName: string | null
  lastName: string
  workEmail: string
  phone: string | null
  joiningDate: string

  employmentStatus:
    EmploymentStatus

  department: {
    id: string
    code: string
    name: string
  }

  jobPosition: {
    id: string
    code: string
    title: string
  }

  manager: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
  } | null

  user: {
    id: string
    email: string
    role: string
    isActive: boolean
  } | null

  createdAt: string
  updatedAt: string
}

export interface EmployeeListResponse {
  employees: Employee[]

  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}