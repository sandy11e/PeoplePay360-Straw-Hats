import { z } from "zod"

import { AttendanceSource, AttendanceStatus } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

// UUID validator
export const uuidSchema = z.string().uuid("Invalid UUID")

// YYYY-MM-DD Date string transformed to midnight UTC Date
export const dateOnlySchema = z
  .string()
  .regex(datePattern, "Date must use YYYY-MM-DD format")
  .transform((val) => new Date(`${val}T00:00:00.000Z`))

// ISO Timestamp validator transformed to Date object
export const isoTimestampSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Invalid ISO timestamp format")
  .transform((val) => new Date(val))

// Self Check-In Schema
export const checkInBodySchema = z.object({
  source: z.nativeEnum(AttendanceSource).optional().default(AttendanceSource.WEB),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  checkInAt: isoTimestampSchema.optional(),
})

// Self Check-Out Schema
export const checkOutBodySchema = z.object({
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  checkOutAt: isoTimestampSchema.optional(),
})

// Manual Attendance Entry Schema (Admin / HR)
export const manualAttendanceSchema = z
  .object({
    employeeId: uuidSchema,
    attendanceDate: dateOnlySchema,
    checkInAt: isoTimestampSchema,
    checkOutAt: isoTimestampSchema.optional().nullable(),
    status: z.nativeEnum(AttendanceStatus).optional(),
    source: z.nativeEnum(AttendanceSource).optional().default(AttendanceSource.MANUAL),
    notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.checkOutAt && data.checkOutAt < data.checkInAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "checkOutAt cannot precede checkInAt",
        path: ["checkOutAt"],
      })
    }
  })

// Update Attendance Schema (Admin / HR)
export const updateAttendanceSchema = z
  .object({
    attendanceDate: dateOnlySchema.optional(),
    checkInAt: isoTimestampSchema.optional(),
    checkOutAt: isoTimestampSchema.optional().nullable(),
    status: z.nativeEnum(AttendanceStatus).optional(),
    source: z.nativeEnum(AttendanceSource).optional(),
    notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.checkInAt && data.checkOutAt && data.checkOutAt < data.checkInAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "checkOutAt cannot precede checkInAt",
        path: ["checkOutAt"],
      })
    }
  })

// Attendance List Query Schema
export const attendanceListQuerySchema = z.object({
  from: z
    .string()
    .regex(datePattern, "from must use YYYY-MM-DD format")
    .optional(),
  to: z
    .string()
    .regex(datePattern, "to must use YYYY-MM-DD format")
    .optional(),
  employeeId: uuidSchema.optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// Attendance ID Param Schema
export const attendanceIdParamSchema = z.object({
  id: uuidSchema,
})

export type CheckInBodyInput = z.infer<typeof checkInBodySchema>
export type CheckOutBodyInput = z.infer<typeof checkOutBodySchema>
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
