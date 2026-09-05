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
    { email: "payrolluser@peoplepay360.local", role: UserRole.PAYROLL_USER },
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

  // Ensure default work schedule exists
  let defaultSchedule = await prisma.workSchedule.findFirst()
  if (!defaultSchedule) {
    defaultSchedule = await prisma.workSchedule.create({
      data: {
        code: "STD-40H",
        name: "Standard 40h",
        timezone: "Asia/Kolkata",
        isActive: true,
      },
    })
  }

  // Ensure all demo users have linked active employee profiles for attendance check-in/out
  const demoProfiles = [
    {
      email: "admin@peoplepay360.local",
      employeeCode: "EMP-ADM-001",
      firstName: "Alex",
      lastName: "Administrator",
      posCode: "ADMIN_DIR",
      posTitle: "System Administrator",
      deptCode: "EXEC",
      deptName: "Executive Administration",
    },
    {
      email: "hr@peoplepay360.local",
      employeeCode: "EMP-HRM-001",
      firstName: "Hannah",
      lastName: "Reyes",
      posCode: "HR_MGR",
      posTitle: "HR Manager",
      deptCode: "HR",
      deptName: "Human Resources",
    },
    {
      email: "payroll@peoplepay360.local",
      employeeCode: "EMP-PAY-001",
      firstName: "Peter",
      lastName: "Payroll",
      posCode: "PAY_MGR",
      posTitle: "Payroll Manager",
      deptCode: "FIN",
      deptName: "Finance & Payroll",
    },
    {
      email: "payrolluser@peoplepay360.local",
      employeeCode: "EMP-PAY-002",
      firstName: "Paul",
      lastName: "Specialist",
      posCode: "PAY_SPEC",
      posTitle: "Payroll Specialist",
      deptCode: "FIN",
      deptName: "Finance & Payroll",
    },
    {
      email: "employee@peoplepay360.local",
      employeeCode: "EMP-DEMO-001",
      firstName: "John",
      lastName: "Doe",
      posCode: "SWE",
      posTitle: "Software Engineer",
      deptCode: "ENG",
      deptName: "Engineering",
    },
  ]

  for (const prof of demoProfiles) {
    const user = await prisma.user.findUnique({ where: { email: prof.email } })
    if (!user) continue

    // Find or create department
    let dept = await prisma.department.findUnique({ where: { code: prof.deptCode } })
    if (!dept) {
      dept = await prisma.department.create({
        data: { code: prof.deptCode, name: prof.deptName },
      })
    }

    // Find or create position
    let pos = await prisma.jobPosition.findUnique({ where: { code: prof.posCode } })
    if (!pos) {
      pos = await prisma.jobPosition.create({
        data: { code: prof.posCode, title: prof.posTitle },
      })
    }

    // Link or create employee record
    let emp = await prisma.employee.findFirst({ where: { userId: user.id } })
    if (emp) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          employmentStatus: "ACTIVE",
        },
      })
      console.log(`Updated active employee link for ${prof.email} (${emp.employeeCode})`)
    } else {
      // Check if employee with code already exists
      const existingByCode = await prisma.employee.findUnique({ where: { employeeCode: prof.employeeCode } })
      if (existingByCode) {
        emp = await prisma.employee.update({
          where: { id: existingByCode.id },
          data: {
            userId: user.id,
            employmentStatus: "ACTIVE",
          },
        })
        console.log(`Linked existing employee ${prof.employeeCode} to user ${prof.email}`)
      } else {
        emp = await prisma.employee.create({
          data: {
            employeeCode: prof.employeeCode,
            firstName: prof.firstName,
            lastName: prof.lastName,
            workEmail: prof.email,
            joiningDate: new Date("2025-01-01T00:00:00.000Z"),
            departmentId: dept.id,
            jobPositionId: pos.id,
            employmentStatus: "ACTIVE",
            userId: user.id,
          },
        })
        console.log(`Created linked employee ${prof.employeeCode} for ${prof.email}`)
      }
    }

    // Ensure schedule assignment exists
    const existingSched = await prisma.employeeScheduleAssignment.findFirst({
      where: { employeeId: emp.id },
    })
    if (!existingSched) {
      await prisma.employeeScheduleAssignment.create({
        data: {
          employeeId: emp.id,
          scheduleId: defaultSchedule.id,
          effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
        },
      })
    }
  }

  // Ensure default Leave Types and 2026 Allocations exist for all employees
  let annualType = await prisma.leaveType.findUnique({ where: { code: "ANNUAL" } })
  if (!annualType) {
    annualType = await prisma.leaveType.create({
      data: { code: "ANNUAL", name: "Annual Leave", isPaid: true, isActive: true },
    })
  }

  const allActiveLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })
  const allEmployees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } })
  for (const emp of allEmployees) {
    for (const lt of allActiveLeaveTypes) {
      const existingAlloc = await prisma.leaveAllocation.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: 2026,
          },
        },
      })
      if (!existingAlloc) {
        await prisma.leaveAllocation.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: 2026,
            allocatedDays: 25,
            usedDays: 0,
          },
        })
        console.log(`Allocated 25 days ${lt.name} (2026) for ${emp.employeeCode}`)
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
