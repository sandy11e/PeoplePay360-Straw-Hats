import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { apiRequest } from "@/api/api"
import type {
  AuthUser,
  LoginResponse,
  MeResponse,
  RefreshResponse,
} from "@/types/auth"

import {
  AuthContext,
} from "./auth-context"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(null)

  const [
    accessToken,
    setAccessToken,
  ] = useState<string | null>(null)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      try {
        const refreshed =
          await apiRequest<RefreshResponse>(
            "/auth/refresh",
            {
              method: "POST",
            },
          )

        setAccessToken(
          refreshed.accessToken,
        )

        const me =
          await apiRequest<MeResponse>(
            "/auth/me",
            {
              accessToken:
                refreshed.accessToken,
            },
          )

        setUser({
          id: me.user.id,
          email: me.user.email,
          role: me.user.role,
        })
      } catch {
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void restoreSession()
  }, [])

  async function login(
    email: string,
    password: string,
  ) {
    const result =
      await apiRequest<LoginResponse>(
        "/auth/login",
        {
          method: "POST",

          body: {
            email,
            password,
          },
        },
      )

    setAccessToken(
      result.accessToken,
    )

    setUser(result.user)
  }

  async function logout() {
    try {
      await apiRequest<void>(
        "/auth/logout",
        {
          method: "POST",
        },
      )
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}