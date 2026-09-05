import { z } from "zod"

import { PayrunStatus } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const uuidSchema = z.string().uuid("Invalid UUID")

export const payrunIdParamSchema = z.object({
  id: uuidSchema,
})

export const createPayrunSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code must be at least 2 characters")
      .max(50, "Code cannot exceed 50 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Code can only contain letters, numbers, hyphens, and underscores")
      .transform((val) => val.toUpperCase()),
    periodStart: z.string().regex(datePattern, "periodStart must use YYYY-MM-DD format"),
    periodEnd: z.string().regex(datePattern, "periodEnd must use YYYY-MM-DD format"),
  })
  .superRefine((data, ctx) => {
    if (data.periodEnd < data.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "periodEnd cannot precede periodStart",
        path: ["periodEnd"],
      })
    }
  })

export const payrunQuerySchema = z.object({
  status: z.nativeEnum(PayrunStatus).optional(),
  from: z.string().regex(datePattern, "from must use YYYY-MM-DD format").optional(),
  to: z.string().regex(datePattern, "to must use YYYY-MM-DD format").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreatePayrunInput = z.infer<typeof createPayrunSchema>
export type PayrunQuery = z.infer<typeof payrunQuerySchema>
