import http from "node:http"
import { AddressInfo } from "node:net"
import assert from "node:assert/strict"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import { UserRole } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING STEP 23: AUDIT LOGGING & SECURITY HARDENING VERIFICATION ===")

  // 1. Start ephemeral HTTP server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`
  console.log(`[Test Server] Listening on ${baseUrl}`)

  try {
    // 2. Setup test users
    const adminUser = await prisma.user.upsert({
      where: { email: "admin.audit@example.com" },
      update: { isActive: true, role: UserRole.ADMIN },
      create: {
        email: "admin.audit@example.com",
        passwordHash: "dummyHash123",
        role: UserRole.ADMIN,
        isActive: true,
      },
    })

    const hrUser = await prisma.user.upsert({
      where: { email: "hr.audit@example.com" },
      update: { isActive: true, role: UserRole.HR_MANAGER },
      create: {
        email: "hr.audit@example.com",
        passwordHash: "dummyHash123",
        role: UserRole.HR_MANAGER,
        isActive: true,
      },
    })

    const employeeUser = await prisma.user.upsert({
      where: { email: "emp.audit@example.com" },
      update: { isActive: true, role: UserRole.EMPLOYEE },
      create: {
        email: "emp.audit@example.com",
        passwordHash: "dummyHash123",
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    })

    const adminToken = await createAccessToken({ userId: adminUser.id, role: adminUser.role })
    const hrToken = await createAccessToken({ userId: hrUser.id, role: hrUser.role })
    const employeeToken = await createAccessToken({ userId: employeeUser.id, role: employeeUser.role })

    // Helper request function
    async function api(
      path: string,
      options: {
        method?: string
        token?: string
        body?: unknown
        headers?: Record<string, string>
      } = {},
    ) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers,
      }
      if (options.token) {
        headers["Authorization"] = `Bearer ${options.token}`
      }

      const init: RequestInit = {
        method: options.method ?? "GET",
        headers,
      }
      if (options.body !== undefined) {
        init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
      }

      const res = await fetch(`${baseUrl}${path}`, init)

      let data: any = null
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }

      return { status: res.status, data }
    }

    // --- TEST 1: RBAC on GET /api/v1/audit-logs ---
    console.log("\n[TEST 1] Audit Log Access Control (ADMIN ONLY)")
    const resNoAuth = await api("/audit-logs")
    assert.equal(resNoAuth.status, 401, "Expected 401 without authentication")

    const resHr = await api("/audit-logs", { token: hrToken })
    assert.equal(resHr.status, 403, "Expected 403 for HR_MANAGER accessing audit logs")

    const resEmp = await api("/audit-logs", { token: employeeToken })
    assert.equal(resEmp.status, 403, "Expected 403 for EMPLOYEE accessing audit logs")

    const resAdmin = await api("/audit-logs", { token: adminToken })
    assert.equal(resAdmin.status, 200, "Expected 200 for ADMIN accessing audit logs")
    assert.ok(Array.isArray(resAdmin.data.auditLogs), "Expected auditLogs array")
    assert.ok(resAdmin.data.pagination, "Expected pagination object")
    console.log("✔ TEST 1 PASSED: Admin-only access enforced.")

    // --- TEST 2: Append-Only Protection ---
    console.log("\n[TEST 2] Append-Only API Protection (No generic UPDATE/DELETE)")
    const resPut = await api("/audit-logs/some-id", { method: "PUT", token: adminToken, body: {} })
    assert.equal(resPut.status, 404, "PUT /audit-logs should not exist")

    const resPatch = await api("/audit-logs/some-id", { method: "PATCH", token: adminToken, body: {} })
    assert.equal(resPatch.status, 404, "PATCH /audit-logs should not exist")

    const resDelete = await api("/audit-logs/some-id", { method: "DELETE", token: adminToken })
    assert.equal(resDelete.status, 404, "DELETE /audit-logs should not exist")
    console.log("✔ TEST 2 PASSED: Append-only integrity verified (No mutation endpoints).")

    // --- TEST 3: User Creation Audit Logging & Secret Omission ---
    console.log("\n[TEST 3] Audit Logging User Creation without leaking passwords")
    const testEmail = `test.audit.${Date.now()}@example.com`
    const resCreateUser = await api("/users", {
      method: "POST",
      token: adminToken,
      body: {
        email: testEmail,
        password: "SuperSecretPassword123!",
        role: "EMPLOYEE",
      },
    })
    assert.equal(resCreateUser.status, 201, "User creation failed")
    const createdUserId = resCreateUser.data.user.id

    // Query audit logs to verify USER_CREATED was logged
    const resAuditUser = await api(`/audit-logs?action=USER_CREATED&entityId=${createdUserId}`, {
      token: adminToken,
    })
    assert.equal(resAuditUser.status, 200)
    assert.ok(resAuditUser.data.auditLogs.length > 0, "USER_CREATED log not found")
    const userAuditLog = resAuditUser.data.auditLogs[0]
    assert.equal(userAuditLog.action, "USER_CREATED")
    assert.equal(userAuditLog.entityType, "User")
    assert.equal(userAuditLog.entityId, createdUserId)
    assert.equal(userAuditLog.actorUserId, adminUser.id)
    assert.equal(userAuditLog.metadata.email, testEmail)
    assert.equal(userAuditLog.metadata.password, undefined, "Password must NEVER be audited")
    assert.equal(userAuditLog.metadata.passwordHash, undefined, "PasswordHash must NEVER be audited")
    console.log("✔ TEST 3 PASSED: User creation audited with zero secret leakage.")

    // --- TEST 4: Role Escalation Protection & Role Change Audit ---
    console.log("\n[TEST 4] Role Escalation Protection and Role Change Audit")
    // 4a. Admin trying to demote/change self should fail
    const resSelfDemote = await api(`/users/${adminUser.id}`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "EMPLOYEE" },
    })
    assert.equal(resSelfDemote.status, 400, "Expected 400 for self role modification")
    assert.equal(resSelfDemote.data.error.code, "ROLE_MODIFICATION_RESTRICTED")

    // 4b. Change role of another user
    const resChangeRole = await api(`/users/${createdUserId}`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "HR_MANAGER" },
    })
    assert.equal(resChangeRole.status, 200, "Role change failed")

    // Verify USER_ROLE_CHANGED was logged
    const resAuditRole = await api(`/audit-logs?action=USER_ROLE_CHANGED&entityId=${createdUserId}`, {
      token: adminToken,
    })
    assert.equal(resAuditRole.status, 200)
    assert.ok(resAuditRole.data.auditLogs.length > 0, "USER_ROLE_CHANGED log not found")
    const roleLog = resAuditRole.data.auditLogs[0]
    assert.equal(roleLog.metadata.previousRole, "EMPLOYEE")
    assert.equal(roleLog.metadata.newRole, "HR_MANAGER")
    console.log("✔ TEST 4 PASSED: Self role demotion blocked and role change audited.")

    // --- TEST 5: User Deactivation, Token Invalidation, and Inactive Enforcement ---
    console.log("\n[TEST 5] User Deactivation Audit & Immediate Token Rejection")
    // Generate token for the test user while still active
    const targetUserToken = await createAccessToken({ userId: createdUserId, role: UserRole.HR_MANAGER })

    // Deactivate user
    const resDeactivate = await api(`/users/${createdUserId}`, {
      method: "PATCH",
      token: adminToken,
      body: { isActive: false },
    })
    assert.equal(resDeactivate.status, 200)

    // Verify USER_DEACTIVATED was logged
    const resAuditDeactivate = await api(`/audit-logs?action=USER_DEACTIVATED&entityId=${createdUserId}`, {
      token: adminToken,
    })
    assert.equal(resAuditDeactivate.status, 200)
    assert.ok(resAuditDeactivate.data.auditLogs.length > 0, "USER_DEACTIVATED log not found")

    // Now attempt to make an API request with the deactivated user's unexpired token
    const resDeactivatedAccess = await api("/dashboard", { token: targetUserToken })
    assert.equal(resDeactivatedAccess.status, 401, "Expected 401 for deactivated user")
    assert.equal(resDeactivatedAccess.data.error.code, "ACCOUNT_DISABLED")
    console.log("✔ TEST 5 PASSED: Inactive user immediately locked out and audited.")

    // --- TEST 6: Password Reset Audit Logging ---
    console.log("\n[TEST 6] Password Reset Audit Logging")
    const resResetPw = await api(`/users/${createdUserId}/reset-password`, {
      method: "POST",
      token: adminToken,
      body: { newPassword: "AnotherSecurePassword987#" },
    })
    assert.equal(resResetPw.status, 200)

    const resAuditPw = await api(`/audit-logs?action=PASSWORD_RESET&entityId=${createdUserId}`, {
      token: adminToken,
    })
    assert.equal(resAuditPw.status, 200)
    assert.ok(resAuditPw.data.auditLogs.length > 0, "PASSWORD_RESET log not found")
    const pwLog = resAuditPw.data.auditLogs[0]
    assert.equal(pwLog.metadata.password, undefined)
    assert.equal(pwLog.metadata.newPassword, undefined)
    assert.equal(pwLog.metadata.passwordHash, undefined)
    console.log("✔ TEST 6 PASSED: Password reset audited without leaking credentials.")

    // --- TEST 7: Security Error Hardening & SQL/Prisma Masking ---
    console.log("\n[TEST 7] Error Middleware Hardening")
    // 7a. Malformed JSON
    const resMalformed = await api("/users", {
      method: "POST",
      token: adminToken,
      body: "{ unquoted_bad_json: 123 ",
      headers: { "Content-Type": "application/json" },
    })
    assert.equal(resMalformed.status, 400)
    assert.equal(resMalformed.data.error.code, "MALFORMED_JSON")
    assert.equal(resMalformed.data.error.stack, undefined, "Stack trace must not be exposed")

    // 7b. Unique constraint conflict (duplicate user email)
    const resDuplicate = await api("/users", {
      method: "POST",
      token: adminToken,
      body: {
        email: testEmail,
        password: "PassWord1234!",
        role: "EMPLOYEE",
      },
    })
    assert.equal(resDuplicate.status, 409)
    assert.ok(
      resDuplicate.data.error.code === "USER_EXISTS" || resDuplicate.data.error.code === "CONFLICT",
      "Expected clean conflict error",
    )
    assert.ok(!JSON.stringify(resDuplicate.data).includes("SELECT * FROM"), "SQL internals must not be leaked")
    console.log("✔ TEST 7 PASSED: Error middleware sanitization and masking verified.")

    // Cleanup created test user
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: adminUser.id },
          { entityId: createdUserId },
        ],
      },
    })
    await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
    console.log("\n✅ ALL STEP 23 VERIFICATION TESTS PASSED SUCCESSFULLY!")
  } finally {
    server.close()
  }
}

runVerification().catch((err) => {
  console.error("Verification failed:", err)
  process.exit(1)
})
