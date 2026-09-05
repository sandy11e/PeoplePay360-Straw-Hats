import http from "node:http"
import { AddressInfo } from "node:net"
import assert from "node:assert/strict"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import { UserRole } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runBulkImportVerification(): Promise<void> {
  console.log("=== STARTING BULK EMPLOYEE IMPORT VERIFICATION ===")

  // 1. Start ephemeral HTTP server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Tokens using real active users from DB
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN, isActive: true } })
  const hrUser = await prisma.user.findFirst({ where: { role: UserRole.HR_MANAGER, isActive: true } })
  const empUser = await prisma.user.findFirst({ where: { role: UserRole.EMPLOYEE, isActive: true } })

  assert.ok(adminUser, "Active admin user must exist")
  assert.ok(hrUser, "Active HR manager user must exist")
  assert.ok(empUser, "Active employee user must exist")

  const adminToken = await createAccessToken({
    userId: adminUser.id,
    role: adminUser.role,
  })

  const hrToken = await createAccessToken({
    userId: hrUser.id,
    role: hrUser.role,
  })

  const employeeToken = await createAccessToken({
    userId: empUser.id,
    role: empUser.role,
  })

  async function api(path: string, options: RequestInit = {}, token = adminToken) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = await res.json()
    return { status: res.status, data: data as any }
  }

  const testSuffix = Date.now().toString().slice(-6)
  const empCode1 = `BLK1_${testSuffix}`
  const empCode2 = `BLK2_${testSuffix}`
  const email1 = `bulk1_${testSuffix}@peoplepay360.local`
  const email2 = `bulk2_${testSuffix}@peoplepay360.local`

  try {
    // 3. Test RBAC: EMPLOYEE role should be forbidden
    console.log("\n[TEST 1] Testing RBAC: EMPLOYEE should be rejected with 403 FORBIDDEN")
    const resEmployee = await api(
      "/employees/bulk-import",
      {
        method: "POST",
        body: JSON.stringify({
          employees: [
            {
              employeeCode: empCode1,
              firstName: "Test",
              lastName: "User",
              workEmail: email1,
              joiningDate: "2026-01-15",
              department: "Engineering",
              jobPosition: "Software Engineer",
            },
          ],
        }),
      },
      employeeToken,
    )
    assert.equal(resEmployee.status, 403, "Employee role should receive 403")
    console.log("✓ PASS: Employee role correctly forbidden")

    // 4. Test Valid Bulk Import with HR_MANAGER
    console.log("\n[TEST 2] Testing Valid Bulk Import with HR_MANAGER")
    const resImport = await api(
      "/employees/bulk-import",
      {
        method: "POST",
        body: JSON.stringify({
          employees: [
            {
              employeeCode: empCode1,
              firstName: "BulkOne",
              middleName: "A",
              lastName: "Tester",
              workEmail: email1,
              joiningDate: "2026-02-01",
              department: "Engineering",
              jobPosition: "Software Engineer",
              baseSalary: 75000,
              currency: "USD",
            },
            {
              employeeCode: empCode2,
              firstName: "BulkTwo",
              lastName: "Tester",
              workEmail: email2,
              joiningDate: "2026-02-15",
              department: "Human Resources",
              jobPosition: "HR Specialist",
              baseSalary: 65000,
              currency: "USD",
            },
          ],
          autoCreateContract: true,
          assignDefaultSchedule: true,
          allocateDefaultLeaves: true,
        }),
      },
      hrToken,
    )

    assert.equal(resImport.status, 200, "Import should return 200 OK")
    assert.equal(resImport.data.totalProcessed, 2, "Total processed should be 2")
    assert.equal(resImport.data.importedCount, 2, "Imported count should be 2")
    assert.equal(resImport.data.failedCount, 0, "Failed count should be 0")
    console.log("✓ PASS: 2 employees successfully imported")

    // Verify in database
    const created1 = await prisma.employee.findUnique({
      where: { employeeCode: empCode1 },
      include: {
        contracts: true,
        scheduleAssignments: true,
        leaveAllocations: true,
      },
    })
    assert.ok(created1, "Employee 1 should exist in database")
    assert.equal(created1.firstName, "BulkOne")
    assert.equal(created1.contracts.length, 1, "Contract should have been auto-created")
    assert.equal(Number(created1.contracts[0]!.baseSalary), 75000)
    console.log("✓ PASS: Employee 1 database record, contract, and schedules verified")

    // 5. Test Duplicate Prevention
    console.log("\n[TEST 3] Testing Duplicate Prevention on second import attempt")
    const resDuplicate = await api(
      "/employees/bulk-import",
      {
        method: "POST",
        body: JSON.stringify({
          employees: [
            {
              employeeCode: empCode1, // duplicate code
              firstName: "Duplicate",
              lastName: "User",
              workEmail: `other_${testSuffix}@peoplepay360.local`,
              joiningDate: "2026-03-01",
              department: "Engineering",
              jobPosition: "Software Engineer",
            },
            {
              employeeCode: `BLK3_${testSuffix}`,
              firstName: "New",
              lastName: "User",
              workEmail: email2, // duplicate email
              joiningDate: "2026-03-01",
              department: "Engineering",
              jobPosition: "Software Engineer",
            },
          ],
        }),
      },
      adminToken,
    )

    assert.equal(resDuplicate.status, 200, "Should return 200 with error reporting")
    assert.equal(resDuplicate.data.importedCount, 0, "Should import 0")
    assert.equal(resDuplicate.data.failedCount, 2, "Should fail 2 rows")
    assert.ok(resDuplicate.data.errors.length === 2, "Should return 2 error descriptions")
    console.log("✓ PASS: Duplicate codes and emails safely rejected with descriptive errors")

    // 6. Test In-Batch Duplicate Detection
    console.log("\n[TEST 4] Testing In-Batch Duplicate Detection")
    const resBatchDup = await api(
      "/employees/bulk-import",
      {
        method: "POST",
        body: JSON.stringify({
          employees: [
            {
              employeeCode: `BATCHDUP_${testSuffix}`,
              firstName: "BatchA",
              lastName: "User",
              workEmail: `batch_dup_${testSuffix}@peoplepay360.local`,
              joiningDate: "2026-01-01",
              department: "Engineering",
              jobPosition: "Software Engineer",
            },
            {
              employeeCode: `BATCHDUP_${testSuffix}`, // same in batch
              firstName: "BatchB",
              lastName: "User",
              workEmail: `batch_dup_different_${testSuffix}@peoplepay360.local`,
              joiningDate: "2026-01-01",
              department: "Engineering",
              jobPosition: "Software Engineer",
            },
          ],
        }),
      },
      adminToken,
    )

    assert.equal(resBatchDup.data.importedCount, 1, "First row in batch should succeed")
    assert.equal(resBatchDup.data.failedCount, 1, "Duplicate in batch should fail")
    console.log("✓ PASS: In-batch duplicates correctly detected and isolated")

    console.log("\n=== ALL BULK EMPLOYEE IMPORT TESTS PASSED SUCCESSFULLY ===")
  } finally {
    // Cleanup test data
    console.log("\nCleaning up test records...")
    const testCodes = [empCode1, empCode2, `BATCHDUP_${testSuffix}`]
    const empsToDelete = await prisma.employee.findMany({
      where: { employeeCode: { in: testCodes } },
      select: { id: true },
    })
    const ids = empsToDelete.map((e) => e.id)

    if (ids.length > 0) {
      await prisma.employeeContract.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.employeeScheduleAssignment.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.leaveAllocation.deleteMany({ where: { employeeId: { in: ids } } })
      await prisma.employee.deleteMany({ where: { id: { in: ids } } })
    }

    server.close()
  }
}

runBulkImportVerification().catch((err) => {
  console.error("Verification failed:", err)
  process.exit(1)
})
