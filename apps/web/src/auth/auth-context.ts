import {
  createContext,
  useContext,
} from "react"

import type {
  ApiOptions,
} from "@/api/api"
import type {
  AuthUser,
} from "@/types/auth"

export interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean

  login: (
    email: string,
    password: string,
  ) => Promise<void>

  logout: () => Promise<void>

  request: <T>(
    path: string,
    options?: ApiOptions,
  ) => Promise<T>
}

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  )

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext)

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    )
  }

  return context
}