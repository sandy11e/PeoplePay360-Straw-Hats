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
import { workScheduleRouter } from "./modules/work-schedules/work-schedule.route.js"
import { attendanceRouter } from "./modules/attendance/attendance.route.js"
import { leaveRouter } from "./modules/leave/leave.route.js"
import { salaryStructureRouter } from "./modules/salary-structures/salary-structure.route.js"
import { payrollRouter } from "./modules/payroll/payroll.route.js"
import { payslipRouter } from "./modules/payslips/payslip.route.js"
import { dashboardRouter } from "./modules/dashboard/dashboard.route.js"
import { auditRouter } from "./modules/audit/audit.route.js"

export const app = express()

app.disable("x-powered-by")

app.use(helmet())

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.use(
  "/api/v1/work-schedules",
  workScheduleRouter,
)

app.use(
  "/api/v1/attendance",
  attendanceRouter,
)

app.use(
  "/api/v1",
  leaveRouter,
)

app.use(
  "/api/v1",
  salaryStructureRouter,
)

app.use(
  "/api/v1",
  payrollRouter,
)

app.use(
  "/api/v1",
  payslipRouter,
)

app.use(
  "/api/v1",
  dashboardRouter,
)

app.use(
  "/api/v1/audit-logs",
  auditRouter,
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