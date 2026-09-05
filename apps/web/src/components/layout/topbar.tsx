import { useLocation } from "react-router-dom"
import { LogOutIcon, MenuIcon, UserCircleIcon } from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/status-badge"

interface TopbarProps {
  onMenuToggle: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  // Generate readable title from pathname
  const getPageTitle = (path: string): string => {
    if (path === "/") return "Overview Dashboard"
    const segments = path.split("/").filter(Boolean)
    if (segments.length === 0) return "Dashboard"

    const firstSegment = segments[0]
    return firstSegment
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      {/* Left section: Hamburger button for mobile & Page Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-label="Open Navigation Menu"
        >
          <MenuIcon className="size-4" />
        </Button>

        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {getPageTitle(location.pathname)}
          </h2>
        </div>
      </div>

      {/* Right section: User profile, role badge, logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <UserCircleIcon className="size-4 text-foreground/70" />
          <span className="font-medium text-foreground">{user?.email}</span>
        </div>

        {user?.role && (
          <StatusBadge status={user.role} category="general" className="tracking-wide text-[10px]" />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void logout()
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Sign out of your session"
        >
          <LogOutIcon className="size-4" />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}
