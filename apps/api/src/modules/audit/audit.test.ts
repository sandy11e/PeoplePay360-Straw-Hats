import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { errorHandler } from "../../middleware/error.middleware.js"
import {
  extractClientInfo,
  isSensitiveKey,
  sanitizeAuditMetadata,
} from "./audit.service.js"
import { auditRouter } from "./audit.route.js"

describe("Audit Logging & Security Hardening Unit Tests", () => {
  describe("Sensitive Key Detection & Metadata Sanitization", () => {
    it("should detect all sensitive key variations regardless of casing or delimiters", () => {
      const sensitiveKeys = [
        "password",
        "PASSWORD",
        "passwordHash",
        "password_hash",
        "newPassword",
        "confirmPassword",
        "token",
        "tokenHash",
        "refreshToken",
        "accessToken",
        "jwt",
        "jwtSecret",
        "JWT_SECRET",
        "secret",
        "authorization",
        "cookie",
        "database_url",
        "DATABASE_URL",
        "smtpPassword",
        "SMTP_PASSWORD",
        "credentials",
        "privateKey",
      ]

      for (const key of sensitiveKeys) {
        assert.equal(
          isSensitiveKey(key),
          true,
          `Expected key "${key}" to be identified as sensitive`,
        )
      }

      const safeKeys = [
        "employeeCode",
        "firstName",
        "lastName",
        "email",
        "role",
        "status",
        "paymentStatus",
        "amount",
        "grossAmount",
        "netAmount",
        "periodStart",
        "periodEnd",
        "count",
        "action",
        "entityType",
      ]

      for (const key of safeKeys) {
        assert.equal(
          isSensitiveKey(key),
          false,
          `Expected key "${key}" to be recognized as safe`,
        )
      }
    })

    it("should completely strip all sensitive keys from metadata object", () => {
      const rawMetadata = {
        email: "alice@peoplepay360.local",
        role: "HR_MANAGER",
        password: "SuperSecretPassword123!",
        passwordHash: "$2a$12$e8k...",
        token: "raw-refresh-token",
        tokenHash: "abc123hash",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        SMTP_PASSWORD: "smtp-secret-key",
        jwtSecret: "my-jwt-secret",
        safeNote: "User role promoted",
      }

      const sanitized = sanitizeAuditMetadata(rawMetadata) as Record<string, unknown>

      assert.equal(sanitized.email, "alice@peoplepay360.local")
      assert.equal(sanitized.role, "HR_MANAGER")
      assert.equal(sanitized.safeNote, "User role promoted")

      // Strictly verify no sensitive keys survived
      assert.equal(sanitized.password, undefined)
      assert.equal(sanitized.passwordHash, undefined)
      assert.equal(sanitized.token, undefined)
      assert.equal(sanitized.tokenHash, undefined)
      assert.equal(sanitized.DATABASE_URL, undefined)
      assert.equal(sanitized.SMTP_PASSWORD, undefined)
      assert.equal(sanitized.jwtSecret, undefined)
    })

    it("should recursively strip sensitive keys from nested objects and arrays", () => {
      const nestedMetadata = {
        action: "UPDATE_PROFILE",
        user: {
          id: "u123",
          email: "bob@example.com",
          auth: {
            passwordHash: "hash-secret",
            refreshToken: "token-secret",
            loginAttempts: 0,
          },
        },
        sessions: [
          { type: "access", token: "tok1" },
          { type: "refresh", tokenHash: "tok2" },
        ],
        rawTokenList: ["secret1", "secret2"],
        details: {
          tags: ["admin", "verified"],
        },
      }

      const sanitized = sanitizeAuditMetadata(nestedMetadata) as any

      assert.equal(sanitized.action, "UPDATE_PROFILE")
      assert.equal(sanitized.user.id, "u123")
      assert.equal(sanitized.user.auth.loginAttempts, 0)
      assert.equal(sanitized.user.auth.passwordHash, undefined)
      assert.equal(sanitized.user.auth.refreshToken, undefined)

      // Key matching token was stripped
      assert.equal(sanitized.rawTokenList, undefined)

      // Array items have their sensitive keys stripped
      assert.equal(sanitized.sessions[0].type, "access")
      assert.equal(sanitized.sessions[0].token, undefined)
      assert.equal(sanitized.sessions[1].type, "refresh")
      assert.equal(sanitized.sessions[1].tokenHash, undefined)
      assert.deepEqual(sanitized.details.tags, ["admin", "verified"])
    })

    it("should detect and redact raw JWT format strings and DB URLs even if placed in safe key names", () => {
      const fakeJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
      const fakeDbUrl = "postgresql://postgres:mysecretpassword@localhost:5432/peoplepay360"

      const metadata = {
        description: fakeJwt,
        connectionString: fakeDbUrl,
        regularText: "This is completely normal text without secrets",
      }

      const sanitized = sanitizeAuditMetadata(metadata) as Record<string, unknown>

      assert.equal(sanitized.description, "[REDACTED_SECRET]")
      assert.equal(sanitized.connectionString, "[REDACTED_SECRET]")
      assert.equal(sanitized.regularText, "This is completely normal text without secrets")
    })
  })

  describe("Client Info Extraction & IP Sanitization", () => {
    it("should extract client IP and user agent safely", () => {
      const mockRequest = {
        header: (name: string) => {
          if (name === "x-forwarded-for") return "192.168.1.100, 10.0.0.1"
          if (name === "user-agent") return "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          return undefined
        },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any

      const clientInfo = extractClientInfo(mockRequest)
      assert.equal(clientInfo.ipAddress, "192.168.1.100")
      assert.equal(clientInfo.userAgent, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    })

    it("should safely truncate oversized IP and UserAgent to prevent database column overflow", () => {
      const longIp = "2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra:overflow:text:here"
      const longAgent = "A".repeat(1000)

      const mockRequest = {
        header: (name: string) => {
          if (name === "x-forwarded-for") return longIp
          if (name === "user-agent") return longAgent
          return undefined
        },
      } as any

      const clientInfo = extractClientInfo(mockRequest)
      assert.ok(clientInfo.ipAddress && clientInfo.ipAddress.length <= 45)
      assert.ok(clientInfo.userAgent && clientInfo.userAgent.length <= 500)
    })
  })

  describe("Append-Only Architecture Verification", () => {
    it("should only expose GET method on auditRouter and reject/omit UPDATE and DELETE", () => {
      const routes = (auditRouter as any).stack.filter((layer: any) => layer.route)
      
      for (const layer of routes) {
        const methods = Object.keys(layer.route?.methods ?? {})
        assert.ok(
          !methods.includes("put"),
          "Audit router must NOT expose any PUT endpoints (append-only enforcement)",
        )
        assert.ok(
          !methods.includes("patch"),
          "Audit router must NOT expose any PATCH endpoints (append-only enforcement)",
        )
        assert.ok(
          !methods.includes("delete"),
          "Audit router must NOT expose any DELETE endpoints (append-only enforcement)",
        )
        assert.ok(
          methods.includes("get"),
          "Audit router should only expose GET for reading audit logs",
        )
      }
    })
  })

  describe("Centralized Error Middleware & Internal Masking", () => {
    it("should map Prisma unique violation (P2002) to 409 without exposing DB constraints or columns", () => {
      let statusCode = 0
      let responseBody: any = null

      const mockResponse: any = {
        headersSent: false,
        status: (code: number) => {
          statusCode = code
          return mockResponse
        },
        json: (body: any) => {
          responseBody = body
          return mockResponse
        },
      }

      const prismaUniqueError = {
        code: "P2002",
        clientVersion: "7.10.0",
        meta: { target: ["users_email_key"] },
        message: "Unique constraint failed on the fields: (`email`) SELECT * FROM users WHERE email = ...",
      }

      errorHandler(prismaUniqueError, {} as any, mockResponse, (() => {}) as any)

      assert.equal(statusCode, 409)
      assert.equal(responseBody.error.code, "CONFLICT")
      assert.equal(responseBody.error.message, "A record with this unique identifier already exists")
      // Ensure raw SQL or Prisma internals are not leaked
      assert.equal(responseBody.error.meta, undefined)
      assert.equal(responseBody.error.clientVersion, undefined)
      assert.ok(!JSON.stringify(responseBody).includes("SELECT * FROM"))
    })

    it("should map Prisma record not found (P2025) to clean 404", () => {
      let statusCode = 0
      let responseBody: any = null

      const mockResponse: any = {
        headersSent: false,
        status: (code: number) => {
          statusCode = code
          return mockResponse
        },
        json: (body: any) => {
          responseBody = body
          return mockResponse
        },
      }

      const prismaNotFoundError = {
        code: "P2025",
        message: "An operation failed because it depends on one or more records that were required but not found.",
      }

      errorHandler(prismaNotFoundError, {} as any, mockResponse, (() => {}) as any)

      assert.equal(statusCode, 404)
      assert.equal(responseBody.error.code, "NOT_FOUND")
      assert.equal(responseBody.error.message, "Requested record not found")
    })

    it("should map syntax errors in request JSON to 400 MALFORMED_JSON", () => {
      let statusCode = 0
      let responseBody: any = null

      const mockResponse: any = {
        headersSent: false,
        status: (code: number) => {
          statusCode = code
          return mockResponse
        },
        json: (body: any) => {
          responseBody = body
          return mockResponse
        },
      }

      const syntaxError = new SyntaxError("Unexpected token } in JSON at position 42")
      ;(syntaxError as any).status = 400
      ;(syntaxError as any).body = "{ invalid json }"

      errorHandler(syntaxError, {} as any, mockResponse, (() => {}) as any)

      assert.equal(statusCode, 400)
      assert.equal(responseBody.error.code, "MALFORMED_JSON")
      assert.equal(responseBody.error.message, "Request body contains invalid JSON")
    })

    it("should map payload too large errors to 413 PAYLOAD_TOO_LARGE", () => {
      let statusCode = 0
      let responseBody: any = null

      const mockResponse: any = {
        headersSent: false,
        status: (code: number) => {
          statusCode = code
          return mockResponse
        },
        json: (body: any) => {
          responseBody = body
          return mockResponse
        },
      }

      const payloadTooLarge = {
        type: "entity.too.large",
        status: 413,
        message: "request entity too large",
      }

      errorHandler(payloadTooLarge, {} as any, mockResponse, (() => {}) as any)

      assert.equal(statusCode, 413)
      assert.equal(responseBody.error.code, "PAYLOAD_TOO_LARGE")
      assert.equal(responseBody.error.message, "Request payload exceeds size limit")
    })

    it("should never expose stack trace or internal error messages for 500 INTERNAL_SERVER_ERROR", () => {
      let statusCode = 0
      let responseBody: any = null

      const mockResponse: any = {
        headersSent: false,
        status: (code: number) => {
          statusCode = code
          return mockResponse
        },
        json: (body: any) => {
          responseBody = body
          return mockResponse
        },
      }

      const criticalDbCrash = new Error("FATAL: terminating connection due to administrator command at /server/db/internal.ts:89")

      errorHandler(criticalDbCrash, {} as any, mockResponse, (() => {}) as any)

      assert.equal(statusCode, 500)
      assert.equal(responseBody.error.code, "INTERNAL_SERVER_ERROR")
      assert.equal(responseBody.error.message, "An unexpected error occurred")
      // Assert zero stack traces or internal filesystem paths
      assert.equal(responseBody.error.stack, undefined)
      assert.ok(!JSON.stringify(responseBody).includes("FATAL: terminating"))
      assert.ok(!JSON.stringify(responseBody).includes("internal.ts"))
    })
  })
})
