const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000/api/v1"

export class ApiError extends Error {
  status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface ApiOptions
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

  const data = await response.json()

  if (!response.ok) {
    const message =
      data?.error?.message ??
      "Request failed"

    throw new ApiError(
      response.status,
      message,
    )
  }

  return data as T
}