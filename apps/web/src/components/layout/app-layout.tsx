import { useState } from "react"
import { Outlet } from "react-router-dom"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/15 to-background text-foreground antialiased">
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/80 bg-sidebar md:block shadow-xs">
        <Sidebar />
      </aside>

      {/* Mobile Drawer (Backdrop + Slideout Panel) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in-0 duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-card shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="absolute right-3 top-4 z-10">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <Sidebar onNavClick={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Topbar onMenuToggle={() => setMobileNavOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  )
}