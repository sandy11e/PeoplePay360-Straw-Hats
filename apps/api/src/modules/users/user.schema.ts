import { z } from "zod"

import { UserRole } from "../../generated/prisma/enums.js"

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase()),

  password: passwordSchema,

  role: z.nativeEnum(UserRole),
})

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
})

export const userListQuerySchema = z.object({
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

export const updateUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((value) => value.toLowerCase())
    .optional(),

  role: z.nativeEnum(UserRole).optional(),

  isActive: z.boolean().optional(),
})

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
})
