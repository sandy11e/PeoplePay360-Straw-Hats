import {
  useState,
  type FormEvent,
} from "react"
import {
  Navigate,
  useNavigate,
} from "react-router-dom"
import {
  ArrowRightIcon,
  CoinsIcon,
  LockIcon,
  MailIcon,
  RefreshCwIcon,
} from "lucide-react"

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Dynamic Animated Background Mesh */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Live Floating Glowing Ambient Light Orbs */}
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/25 blur-3xl animate-orb-1 pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-violet-600/20 blur-3xl animate-orb-2 pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 size-72 rounded-full bg-emerald-500/15 blur-3xl animate-orb-3 pointer-events-none" />
      <div
        className="absolute bottom-1/4 left-1/4 size-80 rounded-full bg-blue-500/15 blur-3xl animate-orb-1 pointer-events-none"
        style={{ animationDelay: "-6s" }}
      />

      {/* Glassmorphic Elevated Login Card */}
      <Card className="relative z-10 w-full max-w-md border border-border/80 bg-card/85 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(59,73,223,0.18)] animate-fade-in-up overflow-hidden">
        {/* Top Animated Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-500 to-violet-500 animate-gradient-flow" />

        <CardHeader className="pt-6 pb-4">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 text-white shadow-[0_4px_16px_-2px_rgba(59,73,223,0.4)] ring-2 ring-primary/30 transition-transform hover:scale-105 animate-gradient-flow">
              <CoinsIcon className="size-6 drop-shadow-xs animate-pulse-glow" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">PeoplePay</CardTitle>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary uppercase tracking-wider animate-pulse">360</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Enterprise HR & Payroll Platform</p>
            </div>
          </div>

          <CardDescription className="text-xs text-muted-foreground">
            Sign in to access your secure payroll and human capital workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">
                Work Email
              </Label>

              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  placeholder="name@company.com"
                  className="pl-9 h-9 text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
                Password
              </Label>

              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 h-9 text-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive animate-fade-in-up">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full h-9 font-semibold transition-all duration-150 cursor-pointer group shadow-sm hover:shadow-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCwIcon className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign in to Workspace</span>
                  <ArrowRightIcon className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}