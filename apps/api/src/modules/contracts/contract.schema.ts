import { z } from "zod"

import { ContractStatus } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const currencyPattern = /^[A-Z]{3}$/

// UUID validator
const uuidSchema = z.string().uuid("Invalid UUID")

// Currency validator - ISO 4217 format
const currencySchema = z
  .string()
  .regex(currencyPattern, "Currency must be 3 uppercase letters (ISO 4217)")
  .transform((value) => value.toUpperCase())

// Contract number normalizer - uppercase and trim
const contractNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .transform((value) => value.toUpperCase())

// Base salary validation
const baseSalarySchema = z
  .union([z.number(), z.string()])
  .refine((value) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return !isNaN(num) && num > 0
  }, "Base salary must be a positive number")
  .transform((value) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return num
  })

// Date validation
const dateSchema = z
  .string()
  .regex(datePattern, "Date must use YYYY-MM-DD format")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

export const createContractSchema = z.object({
  contractNumber: contractNumberSchema,
  employeeId: uuidSchema,
  startDate: dateSchema,
  endDate: z
    .string()
    .regex(datePattern, "End date must use YYYY-MM-DD format")
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .optional()
    .nullable(),
  baseSalary: baseSalarySchema,
  currency: currencySchema,
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable(),
})
  .refine(
    (data) => {
      // endDate must be >= startDate if provided
      if (data.endDate && data.endDate < data.startDate) {
        return false
      }
      return true
    },
    {
      message: "End date must be greater than or equal to start date",
      path: ["endDate"],
    },
  )

export const updateContractSchema = z.object({
  contractNumber: contractNumberSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: z
    .string()
    .regex(datePattern, "End date must use YYYY-MM-DD format")
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .optional()
    .nullable(),
  baseSalary: baseSalarySchema.optional(),
  currency: currencySchema.optional(),
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional(),
})
  .refine(
    (data) => {
      // If both dates are provided or updated, endDate must be >= startDate
      if (
        data.startDate &&
        data.endDate &&
        data.endDate < data.startDate
      ) {
        return false
      }
      return true
    },
    {
      message: "End date must be greater than or equal to start date",
      path: ["endDate"],
    },
  )

export const updateContractStatusSchema = z.object({
  status: z.nativeEnum(ContractStatus),
})

export const contractIdParamSchema = z.object({
  id: uuidSchema,
})

export const employeeIdParamSchema = z.object({
  employeeId: uuidSchema,
})

export const contractListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  employeeId: uuidSchema.optional(),

  status: z.nativeEnum(ContractStatus).optional(),
})

export const employeeContractListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  status: z.nativeEnum(ContractStatus).optional(),
})
