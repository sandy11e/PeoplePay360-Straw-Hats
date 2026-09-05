import { Request, Response, Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  PAYROLL_MANAGE_ACCESS,
  PAYROLL_READ_ACCESS,
  requireRole,
  SALARY_ASSIGNMENT_READ_ACCESS,
} from "../../auth/auth.roles.js"

import {
  assignSalaryStructureSchema,
  createSalaryRuleSchema,
  createSalaryStructureSchema,
  employeeIdParamSchema,
  salaryStructureQuerySchema,
  updateSalaryRuleSchema,
  updateSalaryStructureSchema,
  uuidParamSchema,
} from "./salary-structure.schema.js"
import {
  assignSalaryStructureToEmployee,
  createSalaryRule,
  createSalaryStructure,
  getEmployeeSalaryStructureAssignments,
  getSalaryStructureById,
  listSalaryStructures,
  SalaryStructureError,
  updateSalaryRule,
  updateSalaryStructure,
} from "./salary-structure.service.js"

export const salaryStructureRouter = Router()

function handleSalaryError(error: unknown, response: Response) {
  if (error instanceof SalaryStructureError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    })
    return
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    },
  })
}

// -------------------------------------------------------------
// SALARY STRUCTURE ROUTES
// -------------------------------------------------------------

// POST /api/v1/salary-structures
// Create a new salary structure (ADMIN / PAYROLL_MANAGER only)
salaryStructureRouter.post(
  "/salary-structures",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = createSalaryStructureSchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid salary structure data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const structure = await createSalaryStructure(parsed.data)
      response.status(201).json({ salaryStructure: structure })
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// GET /api/v1/salary-structures
// List salary structures (ADMIN / PAYROLL_MANAGER / PAYROLL_USER)
salaryStructureRouter.get(
  "/salary-structures",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = salaryStructureQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const result = await listSalaryStructures(parsed.data)
      response.status(200).json(result)
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// GET /api/v1/salary-structures/:id
// Get salary structure by ID with rules ordered by sequence
salaryStructureRouter.get(
  "/salary-structures/:id",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = uuidParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid structure ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const structure = await getSalaryStructureById(paramParsed.data.id)
      response.status(200).json({ salaryStructure: structure })
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// PATCH /api/v1/salary-structures/:id
// Update salary structure (ADMIN / PAYROLL_MANAGER only)
salaryStructureRouter.patch(
  "/salary-structures/:id",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = uuidParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid structure ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = updateSalaryStructureSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid structure update data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const updated = await updateSalaryStructure({
        id: paramParsed.data.id,
        ...bodyParsed.data,
      })

      response.status(200).json({ salaryStructure: updated })
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// -------------------------------------------------------------
// SALARY RULE ROUTES
// -------------------------------------------------------------

// POST /api/v1/salary-structures/:id/rules
// Add a rule to a salary structure (ADMIN / PAYROLL_MANAGER only)
salaryStructureRouter.post(
  "/salary-structures/:id/rules",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = uuidParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid structure ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = createSalaryRuleSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid salary rule data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const rule = await createSalaryRule({
        structureId: paramParsed.data.id,
        ...bodyParsed.data,
      })

      response.status(201).json({ salaryRule: rule })
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// PATCH /api/v1/salary-rules/:id
// Update a salary rule (ADMIN / PAYROLL_MANAGER only)
salaryStructureRouter.patch(
  "/salary-rules/:id",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = uuidParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid salary rule ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = updateSalaryRuleSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid salary rule update data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const rule = await updateSalaryRule({
        id: paramParsed.data.id,
        ...bodyParsed.data,
      })

      response.status(200).json({ salaryRule: rule })
    } catch (error) {
      handleSalaryError(error, response)
    }
  },
)

// -------------------------------------------------------------
// EMPLOYEE SALARY STRUCTURE ASSIGNMENT HANDLERS
// -------------------------------------------------------------

// Handler for POST /api/v1/employees/:employeeId/salary-structures
export async function assignEmployeeSalaryStructureHandler(
  request: Request,
  response: Response,
) {
  try {
    const paramParsed = employeeIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID parameter",
          details: paramParsed.error.flatten(),
        },
      })
      return
    }

    const bodyParsed = assignSalaryStructureSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid salary structure assignment data",
          details: bodyParsed.error.flatten(),
        },
      })
      return
    }

    const assignment = await assignSalaryStructureToEmployee({
      employeeId: paramParsed.data.employeeId,
      ...bodyParsed.data,
    })

    response.status(201).json({ assignment })
  } catch (error) {
    handleSalaryError(error, response)
  }
}

// Handler for GET /api/v1/employees/:employeeId/salary-structures
export async function getEmployeeSalaryStructuresHandler(
  request: Request,
  response: Response,
) {
  try {
    const paramParsed = employeeIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID parameter",
          details: paramParsed.error.flatten(),
        },
      })
      return
    }

    const result = await getEmployeeSalaryStructureAssignments(paramParsed.data.employeeId)
    response.status(200).json(result)
  } catch (error) {
    handleSalaryError(error, response)
  }
}
