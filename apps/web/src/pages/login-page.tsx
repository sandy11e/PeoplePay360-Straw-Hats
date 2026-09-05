import {
  useState,
  type FormEvent,
} from "react"

import {
  Navigate,
  useNavigate,
} from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAuth } from "@/auth/auth-context"

export function LoginPage() {
  const navigate = useNavigate()

  const {
    user,
    login,
  } = useAuth()

  const [
    email,
    setEmail,
  ] = useState(
    "admin@peoplepay360.local",
  )

  const [
    password,
    setPassword,
  ] = useState("")

  const [
    error,
    setError,
  ] = useState("")

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  if (user) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault()

    setError("")
    setIsSubmitting(true)

    try {
      await login(
        email,
        password,
      )

      navigate("/")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Login failed",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            PeoplePay360
          </CardTitle>

          <CardDescription>
            Sign in to your HR and payroll workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email">
                Email
              </Label>

              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password
              </Label>

              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Signing in..."
                : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}