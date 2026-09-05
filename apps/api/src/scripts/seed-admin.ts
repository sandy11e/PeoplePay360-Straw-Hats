import { randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import { UserRole } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

const ADMIN_EMAIL =
  "admin@peoplepay360.local"

async function main(): Promise<void> {
  const existing =
    await prisma.user.findUnique({
      where: {
        email: ADMIN_EMAIL,
      },
    })

  if (existing) {
    console.log(
      `Admin already exists: ${ADMIN_EMAIL}`,
    )

    return
  }

  const password =
    randomBytes(18).toString("base64url")

  const passwordHash =
    await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
    },
  })

  console.log("")
  console.log("PeoplePay360 admin created.")
  console.log("")
  console.log(`Email: ${ADMIN_EMAIL}`)
  console.log(`Password: ${password}`)
  console.log("")
  console.log(
    "Save this password now. It will not be shown again.",
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })