import type {
  NextFunction,
  Request,
  Response,
} from "express"

import { UserRole } from "../generated/prisma/enums.js"

import type { AuthContext } from "./auth.middleware.js"

export function requireRole(
  ...allowedRoles: UserRole[]
) {
  return (
    _request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const auth =
      response.locals.auth as
        | AuthContext
        | undefined

    if (!auth) {
      response.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })

      return
    }

    if (!allowedRoles.includes(auth.role)) {
      response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "You do not have permission to access this resource",
        },
      })

      return
    }

    next()
  }
}

export const ADMIN_ONLY = [
  UserRole.ADMIN,
]

export const HR_ACCESS = [
  UserRole.ADMIN,
  UserRole.HR_MANAGER,
]

export const PAYROLL_ACCESS = [
  UserRole.ADMIN,
  UserRole.PAYROLL_MANAGER,
  UserRole.PAYROLL_USER,
]
