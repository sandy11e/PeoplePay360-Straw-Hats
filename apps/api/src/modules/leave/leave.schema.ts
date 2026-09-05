import { z } from "zod"

import { LeaveRequestStatus } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const uuidSchema = z.string().uuid("Invalid UUID")

export const uuidParamSchema = z.object({
  id: uuidSchema,
})

export const employeeIdParamSchema = z.object({
  employeeId: uuidSchema,
})

export const dateOnlyStringSchema = z
  .string()
  .regex(datePattern, "Date must use YYYY-MM-DD format")

// Leave Type schemas
export const createLeaveTypeSchema = z.object({
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
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  isPaid: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
})

export const updateLeaveTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// Leave Allocation schema
export const createLeaveAllocationSchema = z.object({
  employeeId: uuidSchema,
  leaveTypeId: uuidSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  allocatedDays: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = typeof val === "string" ? parseFloat(val) : val
      return !isNaN(num) && num > 0 && num <= 366
    }, "Allocated days must be a positive number up to 366")
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val)),
})

// Leave Request schema
export const createLeaveRequestSchema = z
  .object({
    employeeId: uuidSchema.optional(),
    leaveTypeId: uuidSchema,
    startDate: dateOnlyStringSchema,
    endDate: dateOnlyStringSchema,
    reason: z
      .string()
      .trim()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
      .nullable(),
    isHalfDay: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate cannot precede startDate",
        path: ["endDate"],
      })
    }
    if (data.isHalfDay && data.startDate !== data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Half-day leave can only be requested for a single date (startDate must equal endDate)",
        path: ["isHalfDay"],
      })
    }
  })

// Review leave request schema
export const reviewLeaveRequestSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(500, "Comment cannot exceed 500 characters")
    .optional()
    .nullable(),
})

// Leave Request Query filter schema
export const leaveRequestListQuerySchema = z.object({
  employeeId: uuidSchema.optional(),
  leaveTypeId: uuidSchema.optional(),
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: dateOnlyStringSchema.optional(),
  to: dateOnlyStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// Leave Balances Query schema
export const leaveBalancesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>
export type CreateLeaveAllocationInput = z.infer<typeof createLeaveAllocationSchema>
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>
export type LeaveRequestListQuery = z.infer<typeof leaveRequestListQuerySchema>
export type LeaveBalancesQuery = z.infer<typeof leaveBalancesQuerySchema>
