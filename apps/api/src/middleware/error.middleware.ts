import type { ErrorRequestHandler } from "express"
import { ZodError } from "zod"

import { env } from "../config/env.js"

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    return next(error)
  }

  // Handle SyntaxError from express.json()
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  ) {
    response.status(400).json({
      error: {
        code: "MALFORMED_JSON",
        message: "Request body contains invalid JSON",
      },
    })
    return
  }

  // Handle Payload Too Large
  if (
    (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") ||
    (error && typeof error === "object" && "status" in error && error.status === 413)
  ) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload exceeds size limit",
      },
    })
    return
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Input validation failed",
        fields: error.flatten().fieldErrors,
      },
    })
    return
  }

  // Handle Prisma errors cleanly without exposing schema or database internals
  const prismaCode = (error as { code?: string })?.code

  if (prismaCode === "P2002") {
    response.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A record with this unique identifier already exists",
      },
    })
    return
  }

  if (prismaCode === "P2025") {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Requested record not found",
      },
    })
    return
  }

  if (prismaCode === "P2003") {
    response.status(409).json({
      error: {
        code: "FOREIGN_KEY_VIOLATION",
        message: "Referenced record does not exist or has active dependencies",
      },
    })
    return
  }

  // For any other unexpected error, log server-side but NEVER leak SQL or stack traces to client
  if (env.NODE_ENV !== "production") {
    console.error("[Unhandled API Error]:", error)
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  })
}