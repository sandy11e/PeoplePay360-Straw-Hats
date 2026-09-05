import type {
  NextFunction,
  Request,
  Response,
} from "express"

import type { UserRole } from "../generated/prisma/enums.js"

import { verifyAccessToken } from "./auth.tokens.js"

export interface AuthContext {
  userId: string
  role: UserRole
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = request.header("authorization")

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    })

    return
  }

  const token = authorization.slice(
    "Bearer ".length,
  )

  try {
    const auth = await verifyAccessToken(token)

    response.locals.auth = auth

    next()
  } catch {
    response.status(401).json({
      error: {
        code: "INVALID_ACCESS_TOKEN",
        message: "Access token is invalid or expired",
      },
    })
  }
}