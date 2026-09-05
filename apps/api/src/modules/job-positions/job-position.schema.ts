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
