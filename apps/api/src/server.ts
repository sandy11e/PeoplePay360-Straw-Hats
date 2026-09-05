import { app } from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./lib/prisma.js"

const server = app.listen(env.PORT, () => {
  console.log(
    `PeoplePay360 API running on http://localhost:${env.PORT}`,
  )
})

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully.`)

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close HTTP server:", error)
    } else {
      console.log("HTTP server closed.")
    }

    try {
      await prisma.$disconnect()
      console.log("Prisma disconnected.")
    } catch (dbError) {
      console.error("Failed to disconnect Prisma:", dbError)
      process.exit(1)
    }

    process.exit(error ? 1 : 0)
  })
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))