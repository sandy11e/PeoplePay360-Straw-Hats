import { z } from "zod"

import {
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
} from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const uuidSchema = z.string().uuid("Invalid UUID")

export const uuidParamSchema = z.object({
  id: uuidSchema,
})

export const employeeIdParamSchema = z.object({
  employeeId: uuidSchema,
})

// Salary Structure Schemas
export const createSalaryStructureSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(30, "Code cannot exceed 30 characters")
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
})

export const updateSalaryStructureSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(30, "Code cannot exceed 30 characters")
    .transform((val) => val.toUpperCase())
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
})

// Salary Rule Schemas
export const createSalaryRuleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code must be at least 2 characters")
      .max(30, "Code cannot exceed 30 characters")
      .regex(/^[A-Za-z0-9_]+$/, "Code can only contain letters, numbers, and underscores")
      .transform((val) => val.toUpperCase()),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name cannot exceed 120 characters"),
    category: z.nativeEnum(SalaryRuleCategory),
    calculationType: z.nativeEnum(SalaryRuleCalculationType),
    amount: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val
        return !isNaN(num) && num >= 0
      }, "Fixed amount must be greater than or equal to 0")
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .optional()
      .nullable(),
    percentage: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val
        return !isNaN(num) && num > 0 && num <= 100
      }, "Percentage must be greater than 0 and less than or equal to 100")
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .optional()
      .nullable(),
    base: z.nativeEnum(SalaryRuleBase).optional().nullable(),
    sequence: z
      .coerce
      .number()
      .int("Sequence must be an integer")
      .min(1, "Sequence must be a positive integer (>= 1)"),
    isTaxable: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.calculationType === SalaryRuleCalculationType.FIXED) {
      if (data.amount === undefined || data.amount === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed amount is required when calculationType is FIXED",
          path: ["amount"],
        })
      }
      if (data.percentage !== undefined && data.percentage !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage must not be provided when calculationType is FIXED",
          path: ["percentage"],
        })
      }
      if (data.base !== undefined && data.base !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Base must not be provided when calculationType is FIXED",
          path: ["base"],
        })
      }
    } else if (data.calculationType === SalaryRuleCalculationType.PERCENTAGE) {
      if (data.percentage === undefined || data.percentage === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage is required when calculationType is PERCENTAGE",
          path: ["percentage"],
        })
      }
      if (!data.base) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Base (BASE_SALARY or GROSS_EARNINGS) is required when calculationType is PERCENTAGE",
          path: ["base"],
        })
      }
      if (data.amount !== undefined && data.amount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must not be provided when calculationType is PERCENTAGE",
          path: ["amount"],
        })
      }
    }
  })

export const updateSalaryRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name cannot exceed 120 characters")
      .optional(),
    category: z.nativeEnum(SalaryRuleCategory).optional(),
    calculationType: z.nativeEnum(SalaryRuleCalculationType).optional(),
    amount: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val
        return !isNaN(num) && num >= 0
      }, "Fixed amount must be greater than or equal to 0")
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .optional()
      .nullable(),
    percentage: z
      .union([z.number(), z.string()])
      .refine((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val
        return !isNaN(num) && num > 0 && num <= 100
      }, "Percentage must be greater than 0 and less than or equal to 100")
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .optional()
      .nullable(),
    base: z.nativeEnum(SalaryRuleBase).optional().nullable(),
    sequence: z
      .coerce
      .number()
      .int("Sequence must be an integer")
      .min(1, "Sequence must be a positive integer (>= 1)")
      .optional(),
    isTaxable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.calculationType === SalaryRuleCalculationType.FIXED) {
      if (data.amount === undefined || data.amount === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed amount is required when calculationType is updated to FIXED",
          path: ["amount"],
        })
      }
    } else if (data.calculationType === SalaryRuleCalculationType.PERCENTAGE) {
      if (data.percentage === undefined || data.percentage === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage is required when calculationType is updated to PERCENTAGE",
          path: ["percentage"],
        })
      }
      if (!data.base) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Base is required when calculationType is updated to PERCENTAGE",
          path: ["base"],
        })
      }
    }
  })

// Employee Salary Structure Assignment Schema
export const assignSalaryStructureSchema = z
  .object({
    structureId: uuidSchema,
    effectiveFrom: z.string().regex(datePattern, "effectiveFrom must use YYYY-MM-DD format"),
    effectiveTo: z.string().regex(datePattern, "effectiveTo must use YYYY-MM-DD format").optional().nullable(),
    closePrevious: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "effectiveTo cannot precede effectiveFrom",
        path: ["effectiveTo"],
      })
    }
  })

// Query filters
export const salaryStructureQuerySchema = z.object({
  isActive: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>
export type CreateSalaryRuleInput = z.infer<typeof createSalaryRuleSchema>
export type UpdateSalaryRuleInput = z.infer<typeof updateSalaryRuleSchema>
export type AssignSalaryStructureInput = z.infer<typeof assignSalaryStructureSchema>
export type SalaryStructureQuery = z.infer<typeof salaryStructureQuerySchema>
