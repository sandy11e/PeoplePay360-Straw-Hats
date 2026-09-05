import { z } from "zod"

export const createDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(2)
    .max(120),

  description: z
    .string()
    .trim()
    .max(500)
    .optional(),
})

export const updateDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase())
    .optional(),

  name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .optional(),

  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional(),

  isActive: z.boolean().optional(),
})

export const departmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid department ID"),
})