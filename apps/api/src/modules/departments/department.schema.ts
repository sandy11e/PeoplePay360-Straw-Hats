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