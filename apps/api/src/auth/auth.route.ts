import bcrypt from "bcryptjs"
import cookieParser from "cookie-parser"
import {
  Router,
  type Response,
} from "express"
import { rateLimit } from "express-rate-limit"

import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"

import {
  createAccessToken,
  createRefreshToken,
  createTokenFamilyId,
  getRefreshTokenExpiry,
  hashRefreshToken,
} from "./auth.tokens.js"

import {
  type AuthContext,
  requireAuth,
} from "./auth.middleware.js"

import { loginSchema } from "./auth.schemas.js"

export const authRouter = Router()

const REFRESH_COOKIE = "pp360_refresh_token"

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth",
  maxAge:
    env.REFRESH_TOKEN_TTL_DAYS *
    24 *
    60 *
    60 *
    1000,
}

function clearRefreshCookie(
  response: Response,
): void {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
  })
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts. Try again later.",
    },
  },
})

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many refresh attempts. Try again later.",
    },
  },
})

authRouter.post(
  "/login",
  loginLimiter,
  async (request, response) => {
    const parsed = loginSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid login request",
          fields:
            parsed.error.flatten().fieldErrors,
        },
      })

      return
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!user || !user.isActive) {
      response.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      })

      return
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    )

    if (!passwordMatches) {
      response.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      })

      return
    }

    const rawRefreshToken = createRefreshToken()

    const refreshTokenHash =
      hashRefreshToken(rawRefreshToken)

    const familyId = createTokenFamilyId()

    const expiresAt = getRefreshTokenExpiry()

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      }),

      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          familyId,
          expiresAt,
        },
      }),
    ])

    const accessToken = await createAccessToken({
      userId: user.id,
      role: user.role,
    })

    response.cookie(
      REFRESH_COOKIE,
      rawRefreshToken,
      refreshCookieOptions,
    )

    response.status(200).json({
      accessToken,

      expiresInSeconds:
        env.ACCESS_TOKEN_TTL_MINUTES * 60,

      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })
  },
)

authRouter.post(
  "/refresh",
  refreshLimiter,
  async (request, response) => {
    const rawRefreshToken =
      request.cookies?.[REFRESH_COOKIE]

    if (
      typeof rawRefreshToken !== "string" ||
      rawRefreshToken.length === 0
    ) {
      response.status(401).json({
        error: {
          code: "REFRESH_TOKEN_REQUIRED",
          message: "Refresh token is required",
        },
      })

      return
    }

    const tokenHash =
      hashRefreshToken(rawRefreshToken)

    const storedToken =
      await prisma.refreshToken.findUnique({
        where: {
          tokenHash,
        },

        include: {
          user: true,
        },
      })

    if (!storedToken) {
      clearRefreshCookie(response)

      response.status(401).json({
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Session is invalid",
        },
      })

      return
    }

    if (storedToken.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: {
          familyId: storedToken.familyId,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      })

      clearRefreshCookie(response)

      response.status(401).json({
        error: {
          code: "REFRESH_TOKEN_REUSED",
          message: "Session is no longer valid",
        },
      })

      return
    }

    if (storedToken.expiresAt <= new Date()) {
      await prisma.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      })

      clearRefreshCookie(response)

      response.status(401).json({
        error: {
          code: "REFRESH_TOKEN_EXPIRED",
          message: "Session has expired",
        },
      })

      return
    }

    if (!storedToken.user.isActive) {
      await prisma.refreshToken.updateMany({
        where: {
          familyId: storedToken.familyId,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      })

      clearRefreshCookie(response)

      response.status(403).json({
        error: {
          code: "ACCOUNT_DISABLED",
          message: "Account is disabled",
        },
      })

      return
    }

    const nextRawRefreshToken =
      createRefreshToken()

    const nextTokenHash =
      hashRefreshToken(nextRawRefreshToken)

    const nextExpiry =
      getRefreshTokenExpiry()

    const rotated =
      await prisma.$transaction(
        async (transaction) => {
          const revokeResult =
            await transaction.refreshToken.updateMany(
              {
                where: {
                  id: storedToken.id,
                  revokedAt: null,
                },

                data: {
                  revokedAt: new Date(),
                },
              },
            )

          if (revokeResult.count !== 1) {
            return false
          }

          await transaction.refreshToken.create({
            data: {
              userId: storedToken.userId,
              tokenHash: nextTokenHash,
              familyId: storedToken.familyId,
              expiresAt: nextExpiry,
            },
          })

          return true
        },
      )

    if (!rotated) {
      await prisma.refreshToken.updateMany({
        where: {
          familyId: storedToken.familyId,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      })

      clearRefreshCookie(response)

      response.status(401).json({
        error: {
          code: "REFRESH_TOKEN_REUSED",
          message: "Session is no longer valid",
        },
      })

      return
    }

    const accessToken = await createAccessToken({
      userId: storedToken.user.id,
      role: storedToken.user.role,
    })

    response.cookie(
      REFRESH_COOKIE,
      nextRawRefreshToken,
      refreshCookieOptions,
    )

    response.status(200).json({
      accessToken,

      expiresInSeconds:
        env.ACCESS_TOKEN_TTL_MINUTES * 60,
    })
  },
)

authRouter.post(
  "/logout",
  async (request, response) => {
    const rawRefreshToken =
      request.cookies?.[REFRESH_COOKIE]

    if (typeof rawRefreshToken === "string") {
      const tokenHash =
        hashRefreshToken(rawRefreshToken)

      await prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      })
    }

    clearRefreshCookie(response)

    response.status(204).send()
  },
)

authRouter.get(
  "/me",
  requireAuth,
  async (_request, response) => {
    const auth =
      response.locals.auth as AuthContext

    const user = await prisma.user.findUnique({
      where: {
        id: auth.userId,
      },

      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!user || !user.isActive) {
      response.status(401).json({
        error: {
          code: "ACCOUNT_UNAVAILABLE",
          message: "Account is unavailable",
        },
      })

      return
    }

    response.status(200).json({
      user,
    })
  },
)
