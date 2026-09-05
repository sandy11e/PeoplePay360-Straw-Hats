export type UserRole =
  | "EMPLOYEE"
  | "HR_MANAGER"
  | "PAYROLL_USER"
  | "PAYROLL_MANAGER"
  | "ADMIN"

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export interface LoginResponse {
  accessToken: string
  expiresInSeconds: number

  user: AuthUser
}

export interface RefreshResponse {
  accessToken: string
  expiresInSeconds: number
}

export interface MeResponse {
  user: AuthUser & {
    isActive: boolean
    lastLoginAt: string | null
    createdAt: string
  }
}