import bcrypt from "bcryptjs"
import { UserRole } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function main() {
  const defaultPassword = "Password123!"
  const passwordHash = await bcrypt.hash(defaultPassword, 10)

  const users = [
    { email: "admin@peoplepay360.local", role: UserRole.ADMIN },
    { email: "hr@peoplepay360.local", role: UserRole.HR_MANAGER },
    { email: "payroll@peoplepay360.local", role: UserRole.PAYROLL_MANAGER },
    { email: "employee@peoplepay360.local", role: UserRole.EMPLOYEE },
  ]

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, isActive: true },
      })
      console.log(`Updated user ${u.email} (${u.role})`)
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          role: u.role,
          isActive: true,
        },
      })
      console.log(`Created user ${u.email} (${u.role})`)
    }
  }

  // Ensure employee@peoplepay360.local is linked to an employee record for self-service
  const empUser = await prisma.user.findUnique({
    where: { email: "employee@peoplepay360.local" },
  })

  if (empUser) {
    const existingEmp = await prisma.employee.findFirst({
      where: { userId: empUser.id },
    })

    if (!existingEmp) {
      // Find or create department
      let dept = await prisma.department.findFirst()
      if (!dept) {
        dept = await prisma.department.create({
          data: { code: "ENG", name: "Engineering" },
        })
      }

      // Find or create job position
      let pos = await prisma.jobPosition.findFirst()
      if (!pos) {
        pos = await prisma.jobPosition.create({
          data: { code: "SWE", title: "Software Engineer" },
        })
      }

      await prisma.employee.create({
        data: {
          employeeCode: "EMP-DEMO-001",
          firstName: "John",
          lastName: "Doe",
          workEmail: "employee@peoplepay360.local",
          joiningDate: new Date("2025-01-15T00:00:00.000Z"),
          departmentId: dept.id,
          jobPositionId: pos.id,
          userId: empUser.id,
        },
      })
      console.log("Linked employee record created for employee@peoplepay360.local")
    }
  }

  // Ensure default Leave Types and 2026 Allocations exist for all employees
  let annualType = await prisma.leaveType.findUnique({ where: { code: "ANNUAL" } })
  if (!annualType) {
    annualType = await prisma.leaveType.create({
      data: { code: "ANNUAL", name: "Annual Leave", isPaid: true, isActive: true },
    })
  }

  const allEmployees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } })
  for (const emp of allEmployees) {
    const existingAlloc = await prisma.leaveAllocation.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp.id,
          leaveTypeId: annualType.id,
          year: 2026,
        },
      },
    })
    if (!existingAlloc) {
      await prisma.leaveAllocation.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: annualType.id,
          year: 2026,
          allocatedDays: 25,
          usedDays: 0,
        },
      })
      console.log(`Allocated 25 days Annual Leave (2026) for ${emp.employeeCode}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
