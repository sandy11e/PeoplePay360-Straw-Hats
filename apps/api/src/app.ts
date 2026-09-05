import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import helmet from "helmet"
import { accessRouter } from "./routes/access.route.js"
import { authRouter } from "./auth/auth.route.js"
import { env } from "./config/env.js"
import { errorHandler } from "./middleware/error.middleware.js"
import { healthRouter } from "./routes/health.route.js"
import { departmentRouter } from "./modules/departments/department.route.js"
import { employeeRouter } from "./modules/employees/employee.route.js"
import { jobPositionRouter } from "./modules/job-positions/job-position.route.js"
import { userRouter } from "./modules/users/user.route.js"
import { contractRouter } from "./modules/contracts/contract.route.js"

export const app = express()

app.disable("x-powered-by")

app.use(helmet())

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json({
  limit: "1mb",
}))

app.use(cookieParser())

app.use(
  "/api/v1/health",
  healthRouter,
)

app.use(
  "/api/v1/auth",
  authRouter,
)

app.use(
  "/api/v1/access",
  accessRouter,
)

app.use(
  "/api/v1/users",
  userRouter,
)

app.use(
  "/api/v1/departments",
  departmentRouter,
)

app.use(
  "/api/v1/job-positions",
  jobPositionRouter,
)

app.use(
  "/api/v1/employees",
  employeeRouter,
)

app.use(
  "/api/v1/contracts",
  contractRouter,
)

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  })
})



app.use(errorHandler)