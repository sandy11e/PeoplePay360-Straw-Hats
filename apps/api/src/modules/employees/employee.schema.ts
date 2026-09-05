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

export const bulkImportEmployeeItemSchema = z.object({
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
    .optional()
    .nullable(),

  lastName: z
    .string()
    .trim()
    .min(1)
    .max(100),

  workEmail: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),

  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable(),

  joiningDate: z
    .string()
    .regex(datePattern, "joiningDate must use YYYY-MM-DD"),

  department: z
    .string()
    .trim()
    .min(1)
    .max(120),

  jobPosition: z
    .string()
    .trim()
    .min(1)
    .max(120),

  manager: z
    .string()
    .trim()
    .optional()
    .nullable(),

  employmentStatus: z
    .nativeEnum(EmploymentStatus)
    .optional()
    .default(EmploymentStatus.ACTIVE),

  baseSalary: z
    .number()
    .nonnegative()
    .optional()
    .nullable(),

  currency: z
    .string()
    .trim()
    .length(3)
    .optional()
    .default("USD"),

  salaryStructure: z
    .string()
    .trim()
    .optional()
    .nullable(),
})

export const bulkImportEmployeesSchema = z.object({
  employees: z
    .array(bulkImportEmployeeItemSchema)
    .min(1, "At least one employee must be provided")
    .max(500, "Maximum 500 employees per import batch"),

  autoCreateContract: z
    .boolean()
    .optional()
    .default(true),

  assignDefaultSchedule: z
    .boolean()
    .optional()
    .default(true),

  allocateDefaultLeaves: z
    .boolean()
    .optional()
    .default(true),
})

export type BulkImportEmployeeItem = z.infer<typeof bulkImportEmployeeItemSchema>
export type BulkImportEmployeesInput = z.infer<typeof bulkImportEmployeesSchema>