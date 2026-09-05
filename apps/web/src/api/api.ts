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
  responseType?: "json" | "blob"
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    body,
    accessToken,
    headers,
    responseType = "json",
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
          ? typeof body === "string"
            ? body
            : JSON.stringify(body)
          : undefined,
    },
  )

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    let message = "Request failed"
    let data: unknown

    try {
      data = await response.json()

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
    } catch {
      message = await response.text().catch(() => "Request failed")
    }

    throw new ApiError(
      response.status,
      message,
      data,
    )
  }

  if (responseType === "blob") {
    return (await response.blob()) as T
  }

  const data: unknown =
    await response.json()

  return data as T
}