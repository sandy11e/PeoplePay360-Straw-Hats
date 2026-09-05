import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto"

import {
  SignJWT,
  jwtVerify,
} from "jose"

import { env } from "../config/env.js"
import { UserRole } from "../generated/prisma/enums.js"

const accessSecret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET,
)

const ISSUER = "peoplepay360-api"
const AUDIENCE = "peoplepay360-web"

export interface AccessTokenPayload {
  userId: string
  role: UserRole
}

export async function createAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  return new SignJWT({
    role: payload.role,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(
      `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    )
    .sign(accessSecret)
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(
    token,
    accessSecret,
    {
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  )

  if (!payload.sub) {
    throw new Error("Access token is missing subject")
  }

  const role = payload.role

  if (
    typeof role !== "string" ||
    !Object.values(UserRole).includes(role as UserRole)
  ) {
    throw new Error("Access token contains invalid role")
  }

  return {
    userId: payload.sub,
    role: role as UserRole,
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url")
}

export function hashRefreshToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex")
}

export function createTokenFamilyId(): string {
  return randomUUID()
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date()

  expiry.setDate(
    expiry.getDate() + env.REFRESH_TOKEN_TTL_DAYS,
  )

  return expiry
}