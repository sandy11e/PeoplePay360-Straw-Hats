import { Router } from "express"

export const healthRouter = Router()

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "peoplepay360-api",
    timestamp: new Date().toISOString(),
  })
})