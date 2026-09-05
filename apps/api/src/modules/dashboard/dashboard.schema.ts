import { z } from "zod"

export const dashboardRecentQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5))
    .pipe(z.number().int().min(1).max(50)),
})

export type DashboardRecentQuery = z.infer<typeof dashboardRecentQuerySchema>
