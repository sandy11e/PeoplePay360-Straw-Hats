import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  ApiError,
  apiRequest,
  type ApiOptions,
} from "@/api/api"

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

  const refreshPromise =
    useRef<Promise<string> | null>(
      null,
    )

  const refreshAccessToken =
    useCallback(
      async (): Promise<string> => {
        if (refreshPromise.current) {
          return refreshPromise.current
        }

        const promise = (
          async () => {
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

            return refreshed.accessToken
          }
        )()

        refreshPromise.current = promise

        try {
          return await promise
        } finally {
          refreshPromise.current = null
        }
      },
      [],
    )

  useEffect(() => {
    async function restoreSession() {
      try {
        const token =
          await refreshAccessToken()

        const me =
          await apiRequest<MeResponse>(
            "/auth/me",
            {
              accessToken: token,
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
  }, [refreshAccessToken])

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

  async function request<T>(
    path: string,
    options: ApiOptions = {},
  ): Promise<T> {
    let token = accessToken

    if (!token) {
      try {
        token =
          await refreshAccessToken()
      } catch {
        setUser(null)
        setAccessToken(null)

        throw new ApiError(
          401,
          "Authentication required",
        )
      }
    }

    try {
      return await apiRequest<T>(
        path,
        {
          ...options,
          accessToken: token,
        },
      )
    } catch (error) {
      if (
        !(
          error instanceof ApiError
        ) ||
        error.status !== 401
      ) {
        throw error
      }

      try {
        const newToken =
          await refreshAccessToken()

        return await apiRequest<T>(
          path,
          {
            ...options,
            accessToken:
              newToken,
          },
        )
      } catch (refreshError) {
        setUser(null)
        setAccessToken(null)

        throw refreshError
      }
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
        request,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}