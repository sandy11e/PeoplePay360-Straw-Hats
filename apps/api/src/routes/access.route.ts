import { Router } from "express"

import {
  ADMIN_ONLY,
  HR_ACCESS,
  PAYROLL_ACCESS,
  requireRole,
} from "../auth/auth.roles.js"

import { requireAuth } from "../auth/auth.middleware.js"

export const accessRouter = Router()

accessRouter.get(
  "/authenticated",
  requireAuth,
  (_request, response) => {
    response.status(200).json({
      message:
        "Authenticated access granted",
    })
  },
)

accessRouter.get(
  "/admin",
  requireAuth,
  requireRole(...ADMIN_ONLY),
  (_request, response) => {
    response.status(200).json({
      message:
        "Admin access granted",
    })
  },
)

accessRouter.get(
  "/hr",
  requireAuth,
  requireRole(...HR_ACCESS),
  (_request, response) => {
    response.status(200).json({
      message:
        "HR access granted",
    })
  },
)

accessRouter.get(
  "/payroll",
  requireAuth,
  requireRole(...PAYROLL_ACCESS),
  (_request, response) => {
    response.status(200).json({
      message:
        "Payroll access granted",
    })
  },
)