import type { UserRole } from "./auth"

export interface UserListItem {
  id: string
  email: string
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface UserListResponse {
  users: UserListItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface CreateUserPayload {
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserRolePayload {
  role: UserRole
}

export interface UpdateUserStatusPayload {
  isActive: boolean
}

export interface ResetUserPasswordPayload {
  newPassword: string
}
