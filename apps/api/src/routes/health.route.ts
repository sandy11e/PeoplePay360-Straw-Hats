import { Router } from "express"

import { prisma } from "../lib/prisma.js"

export const healthRouter = Router()

healthRouter.get("/", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    response.status(200).json({
      status: "ok",
      service: "peoplepay360-api",
      database: "connected",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Database health check failed:", error)

    response.status(503).json({
      status: "error",
      service: "peoplepay360-api",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    })
  }
})