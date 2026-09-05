import { z } from "zod"
import { PaymentStatus, PayslipStatus } from "../../generated/prisma/enums.js"

export const generatePayslipsSchema = z.object({
  status: z.nativeEnum(PayslipStatus).optional(),
  overwriteDrafts: z.boolean().optional().default(false),
})

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus),
  status: z.nativeEnum(PayslipStatus).optional(),
})

export const listPayrunPayslipsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: z.nativeEnum(PayslipStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().optional(),
})

export const listMyPayslipsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: z.nativeEnum(PayslipStatus).optional(),
})

export type GeneratePayslipsInput = z.infer<typeof generatePayslipsSchema>
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>
export type ListPayrunPayslipsQuery = z.infer<typeof listPayrunPayslipsQuerySchema>
export type ListMyPayslipsQuery = z.infer<typeof listMyPayslipsQuerySchema>
