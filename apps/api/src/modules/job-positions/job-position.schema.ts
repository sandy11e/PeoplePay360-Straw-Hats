import { z } from "zod"

export const createJobPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),

  title: z
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

export const updateJobPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase())
    .optional(),

  title: z
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

export const jobPositionIdParamSchema = z.object({
  id: z.string().uuid("Invalid job position ID"),
})
