import { describe, expect, it } from "vitest"
import { ApiError } from "./api"

describe("ApiError class", () => {
  it("creates ApiError instance with status and message", () => {
    const err = new ApiError(404, "Employee not found", { code: "NOT_FOUND" })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.name).toBe("ApiError")
    expect(err.status).toBe(404)
    expect(err.message).toBe("Employee not found")
    expect(err.data).toEqual({ code: "NOT_FOUND" })
  })

  it("handles 401 Unauthorized errors", () => {
    const err = new ApiError(401, "Token expired")
    expect(err.status).toBe(401)
    expect(err.message).toBe("Token expired")
  })

  it("handles 403 Forbidden errors", () => {
    const err = new ApiError(403, "Forbidden resource")
    expect(err.status).toBe(403)
  })

  it("handles 409 Conflict errors with details", () => {
    const err = new ApiError(409, "Employee code already exists", {
      field: "employeeCode",
    })
    expect(err.status).toBe(409)
    expect((err.data as { field: string }).field).toBe("employeeCode")
  })
})
