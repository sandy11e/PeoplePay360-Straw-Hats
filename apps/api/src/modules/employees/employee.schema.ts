import { z } from "zod"

import { EmploymentStatus } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const createEmployeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),

  firstName: z
    .string()
    .trim()
    .min(1)
    .max(100),

  middleName: z
    .string()
    .trim()
    .max(100)
    .optional(),

  lastName: z
    .string()
    .trim()
    .min(1)
    .max(100),

  workEmail: z
    .string()
    .trim()
    .email()
    .transform((value) =>
      value.toLowerCase(),
    ),

  phone: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .optional(),

  joiningDate: z
    .string()
    .regex(
      datePattern,
      "joiningDate must use YYYY-MM-DD",
    ),

  departmentId: z.string().uuid(),

  jobPositionId: z.string().uuid(),

  managerId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  userId: z
    .string()
    .uuid()
    .nullable()
    .optional(),
})

export const updateEmployeeSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  middleName: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional(),

  lastName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  workEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase())
    .optional(),

  phone: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .nullable()
    .optional(),

  departmentId: z.string().uuid().optional(),

  jobPositionId: z.string().uuid().optional(),

  managerId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  userId: z
    .string()
    .uuid()
    .nullable()
    .optional(),
})

export const updateEmploymentStatusSchema = z.object({
  status: z.nativeEnum(EmploymentStatus),
})

export const employeeListQuerySchema = z.object({
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
})

export const employeeIdParamSchema = z.object({
  id: z.string().uuid(),
})