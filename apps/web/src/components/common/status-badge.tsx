import { Badge } from "@/components/ui/badge"
import { cn } from "cn"

export type StatusCategory =
  | "employment"
  | "contract"
  | "leave"
  | "payrun"
  | "payment"
  | "attendance"
  | "general"

interface StatusBadgeProps {
  status: string | null | undefined
  category?: StatusCategory
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) {
    return <Badge variant="outline" className={cn("text-muted-foreground", className)}>—</Badge>
  }

  const s = status.toUpperCase()

  // Success / Active states (Green)
  const isSuccess = [
    "ACTIVE",
    "APPROVED",
    "PAID",
    "VALIDATED",
    "PRESENT",
  ].includes(s)

  // Warning / Pending / Notice states (Amber/Yellow)
  const isWarning = [
    "PENDING",
    "PROCESSING",
    "NOTICE_PERIOD",
    "CALCULATED",
    "LATE",
    "HALF_DAY",
  ].includes(s)

  // Info / Draft / Neutral states (Blue/Slate)
  const isInfo = [
    "DRAFT",
    "ON_LEAVE",
  ].includes(s)

  // Destructive / Inactive / Cancelled / Rejected states (Red/Rose)
  const isDestructive = [
    "TERMINATED",
    "RESIGNED",
    "INACTIVE",
    "REJECTED",
    "CANCELLED",
    "EXPIRED",
    "FAILED",
    "ABSENT",
  ].includes(s)

  if (isSuccess) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {status.replace(/_/g, " ")}
      </span>
    )
  }

  if (isWarning) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-amber-500" />
        {status.replace(/_/g, " ")}
      </span>
    )
  }

  if (isInfo) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-blue-500" />
        {status.replace(/_/g, " ")}
      </span>
    )
  }

  if (isDestructive) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-rose-500" />
        {status.replace(/_/g, " ")}
      </span>
    )
  }

  return (
    <Badge variant="outline" className={cn("capitalize", className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
