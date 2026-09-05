import { app } from "./app.js"
import { env } from "./config/env.js"

const server = app.listen(env.PORT, () => {
  console.log(
    `PeoplePay360 API running on http://localhost:${env.PORT}`,
  )
})

const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully.`)

  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server:", error)
      process.exit(1)
    }

    console.log("HTTP server closed.")
    process.exit(0)
  })
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))