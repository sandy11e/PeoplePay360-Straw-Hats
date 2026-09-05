import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  EyeIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatMoney } from "@/utils/format"
import { canManagePayroll } from "@/utils/roles"

interface PayrunRecord {
  id: string
  code: string
  periodStart: string
  periodEnd: string
  status: string
  employeeCount: number
  totalGross: string | null
  totalDeductions: string | null
  totalNet: string | null
  createdAt: string
}

interface PayrunListResponse {
  payruns: PayrunRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function PayrunsPage() {
  const { request, user } = useAuth()
  const canManage = canManagePayroll(user?.role)

  const [payruns, setPayruns] = useState<PayrunRecord[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [code, setCode] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const fetchPayruns = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      let url = `/payruns?page=${page}&pageSize=${pageSize}`
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`
      }

      const res = await request<PayrunListResponse>(url)
      setPayruns(res.payruns)
      setTotalPages(res.pagination.totalPages)
      setTotalCount(res.pagination.total)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load payruns")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, request, statusFilter])

  useEffect(() => {
    void fetchPayruns()
  }, [fetchPayruns])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateModal() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    setCode(`PR-${year}-${month}`)

    // Start & End of current month
    const firstDay = `${year}-${month}-01`
    const lastDayDate = new Date(year, now.getMonth() + 1, 0)
    const lastDay = `${year}-${month}-${String(lastDayDate.getDate()).padStart(2, "0")}`

    setPeriodStart(firstDay)
    setPeriodEnd(lastDay)
    setCreateOpen(true)
  }

  async function handleCreatePayrun(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (periodEnd < periodStart) {
      setErrorMessage("Period end date cannot precede period start date")
      return
    }

    try {
      setIsCreating(true)
      await request("/payruns", {
        method: "POST",
        body: {
          code: code.trim().toUpperCase(),
          periodStart,
          periodEnd,
        },
      })

      setSuccessMessage(`Payrun ${code} created in DRAFT status`)
      setCreateOpen(false)
      void fetchPayruns()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create payrun")
    } finally {
      setIsCreating(false)
    }
  }

  const filteredPayruns = payruns.filter((p) => {
    const q = searchTerm.toLowerCase()
    return p.code.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll Runs</h1>
          <p className="text-sm text-muted-foreground">
            Execute batch payroll calculation periods, verify earnings/deductions, and finalize payslips.
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreateModal} className="gap-2 shadow-xs">
            <PlusIcon className="size-4" />
            <span>Create Payrun</span>
          </Button>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in-50">
          <AlertCircleIcon className="size-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400 animate-in fade-in-50">
          <CheckCircle2Icon className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Payrun Cycles</CardTitle>
              <CardDescription>
                {totalCount} total payroll calculation period{totalCount === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="CALCULATED">Calculated</option>
                <option value="VALIDATED">Validated (Final)</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredPayruns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48">
                      <EmptyState
                        title="No payruns found"
                        description={
                          searchTerm || statusFilter !== "ALL"
                            ? "No payroll periods match your filters."
                            : "Create a payrun period to begin batch compensation calculations."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayruns.map((pr) => (
                    <TableRow key={pr.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {pr.code}
                      </TableCell>

                      <TableCell className="text-sm">
                        {formatDate(pr.periodStart)} → {formatDate(pr.periodEnd)}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={pr.status} category="payrun" />
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        {pr.employeeCount} employee{pr.employeeCount === 1 ? "" : "s"}
                      </TableCell>

                      <TableCell className="text-sm font-medium">
                        {pr.totalGross ? formatMoney(pr.totalGross) : "—"}
                      </TableCell>

                      <TableCell className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        {pr.totalDeductions ? formatMoney(pr.totalDeductions) : "—"}
                      </TableCell>

                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {pr.totalNet ? formatMoney(pr.totalNet) : "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link to={`/payruns/${pr.id}`} />}
                          className="h-8 gap-1 px-2 text-xs"
                        >
                          <EyeIcon className="size-3.5" />
                          <span>Review</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE PAYRUN MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Payrun Period</DialogTitle>
            <DialogDescription>
              Define the settlement cycle window. The payrun will be created in DRAFT status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePayrun} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-code">Payrun Code</Label>
              <Input
                id="pr-code"
                required
                placeholder="e.g. PR-2026-09"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pr-start">Period Start</Label>
                <Input
                  id="pr-start"
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pr-end">Period End</Label>
                <Input
                  id="pr-end"
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Initiating..." : "Create Payrun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
