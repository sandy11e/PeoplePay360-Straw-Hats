import { Link, useLocation } from "react-router-dom"
import { LogOutIcon, MenuIcon, TimerIcon } from "lucide-react"

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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/80 bg-card/85 px-4 backdrop-blur-md sm:px-6 shadow-2xs">
      {/* Left section: Hamburger button for mobile & Page Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="md:hidden border-border"
          onClick={onMenuToggle}
          aria-label="Open Navigation Menu"
        >
          <MenuIcon className="size-4" />
        </Button>

        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-primary" />
          <h2 className="text-base font-bold tracking-tight text-foreground">
            {getPageTitle(location.pathname)}
          </h2>
        </div>
      </div>

      {/* Right section: User profile, role badge, logout */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/my-attendance" />}
          className="group hidden sm:inline-flex items-center gap-2 h-8 rounded-lg px-3 text-xs font-semibold bg-secondary text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
          title="Personal Punch Clock (Check In / Out)"
        >
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <TimerIcon className="size-3.5 text-primary transition-transform duration-200 group-hover:rotate-12" />
          <span>Punch Clock</span>
        </Button>

        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1 shadow-2xs">
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-[10px]">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-xs font-semibold text-foreground/90 max-w-[140px] truncate">{user?.email}</span>
          {user?.role && (
            <StatusBadge status={user.role} category="general" className="tracking-wide text-[9px] px-2 py-0" />
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void logout()
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-8 text-xs font-medium cursor-pointer"
          title="Sign out of your session"
        >
          <LogOutIcon className="size-3.5" />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}
