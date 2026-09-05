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
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error("Invalid environment configuration:")
  console.error(result.error.flatten().fieldErrors)

  throw new Error("Environment configuration validation failed")
}

export const env = result.data