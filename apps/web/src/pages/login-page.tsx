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
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
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
import { WaveBackground } from "@/components/common/wave-background"

export function LoginPage() {
  const navigate = useNavigate()
  const { user, login } = useAuth()

  const [email, setEmail] = useState("admin@peoplepay360.local")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await login(email, password)
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
    <main className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background px-6 py-8 antialiased">
      {/* 1. Signature Fluid Wave Background (Hero Composition) */}
      <WaveBackground variant="hero" />

      {/* 2. Top Header Navigation (Matching "Your Logo" and "Home / About / Help") */}
      <header className="relative z-20 flex items-center justify-between max-w-7xl w-full mx-auto">
        
          

      </header>

      {/* 3. Main Center Content Grid */}
      <div className="relative z-20 flex-1 flex flex-col lg:flex-row items-center justify-between max-w-7xl w-full mx-auto py-12 gap-12">
        {/* Left Hero Title (Matching "Design." in Reference Image) */}
        <div className="flex-1 max-w-lg space-y-4">
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#071638] dark:text-white leading-none">
              Payroll<span className="text-[#082366] dark:text-[#82a5ff]">.</span>
            </h1>
            <div className="h-2 w-16 bg-[#071638] dark:bg-[#82a5ff] rounded-full" />
          </div>

          <p className="text-sm font-medium text-[#071638]/75 dark:text-muted-foreground leading-relaxed max-w-md">
            Next-generation enterprise human capital, attendance precision tracking, and automated regulatory payroll processing in one unified canvas.
          </p>

          <div className="pt-2 flex items-center gap-4 text-xs font-semibold text-[#071638]/80 dark:text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-4 text-[#082366] dark:text-[#82a5ff]" />
              <span>SOC2 Compliant</span>
            </div>
            <span>•</span>
            <div>Zero-Variance Calculations</div>
            <span>•</span>
            <div>Automated PDF Payslips</div>
          </div>
        </div>

        {/* Right Elevated Login Card */}
        <div className="w-full max-w-md">
          <Card className="border border-[#c7d4fc]/70 bg-white/95 dark:bg-card/90 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(8,35,102,0.18)] animate-fade-in-up overflow-hidden rounded-2xl">
            {/* Top Accent Stripe */}
            <div className="h-2 w-full bg-gradient-to-r from-[#082366] via-[#103e9c] to-[#c7d4fc]" />

            <CardHeader className="pt-6 pb-4">
              <CardTitle className="text-xl font-bold tracking-tight text-[#071638] dark:text-foreground">
                Sign in to your workspace
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your authorized credentials to access organizational records.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-[#071638]/90 dark:text-foreground/90">
                    Work Email
                  </Label>

                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      placeholder="name@company.com"
                      className="pl-9 h-10 text-sm border-border transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-[#071638]/90 dark:text-foreground/90">
                    Password
                  </Label>

                  <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-9 pr-10 h-10 text-sm border-border transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive animate-fade-in-up">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full h-10 font-semibold transition-all duration-150 cursor-pointer group shadow-sm hover:shadow-md bg-[#082366] hover:bg-[#0c2f82] text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCwIcon className="mr-2 size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span>Enter Workspace</span>
                      <ArrowRightIcon className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Footer info */}
      <footer className="relative z-20 max-w-7xl w-full mx-auto text-[11px] text-[#071638]/60 dark:text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 PeoplePay360 Inc. Enterprise Precision Payroll.</p>
        <p>Protected by Enterprise Grade Encryption & Audit Logs.</p>
      </footer>
    </main>
  )
}