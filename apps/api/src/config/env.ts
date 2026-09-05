import "dotenv/config"

import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(3000),

  CORS_ORIGIN: z
    .string()
    .url()
    .default("http://localhost:5173"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

  ACCESS_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(60)
    .default(15),

  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .max(30)
    .default(7),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional().default("noreply@peoplepay360.com"),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error("Invalid environment configuration:")
  console.error(result.error.flatten().fieldErrors)

  throw new Error("Environment configuration validation failed")
}

export const env = result.data