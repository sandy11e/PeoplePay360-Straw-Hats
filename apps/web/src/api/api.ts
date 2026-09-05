const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000/api/v1"

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(
    status: number,
    message: string,
    data?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

export interface ApiOptions
  extends Omit<RequestInit, "body"> {
  body?: unknown
  accessToken?: string | null
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    body,
    accessToken,
    headers,
    ...requestOptions
  } = options

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...requestOptions,

      credentials: "include",

      headers: {
        ...(body !== undefined
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),

        ...(accessToken
          ? {
              Authorization:
                `Bearer ${accessToken}`,
            }
          : {}),

        ...headers,
      },

      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    },
  )

  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown =
    await response.json()

  if (!response.ok) {
    let message = "Request failed"

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data
    ) {
      const error =
        (
          data as {
            error?: {
              message?: unknown
            }
          }
        ).error

      if (
        typeof error?.message ===
        "string"
      ) {
        message = error.message
      }
    }

    throw new ApiError(
      response.status,
      message,
      data,
    )
  }

  return data as T
}