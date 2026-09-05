import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  RefreshCwIcon,
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
import type { MyPayslipsResponse, Payslip } from "@/types/payslip"
import { triggerBlobDownload } from "@/utils/download"
import { formatDate, formatMoney } from "@/utils/format"

export function MyPayslipsPage() {
  const { request } = useAuth()

  const [data, setData] = useState<MyPayslipsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // PDF downloading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // View modal state
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)

  const loadMyPayslips = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await request<MyPayslipsResponse>(
        `/me/payslips?page=${page}&limit=10`,
      )
      setData(res)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to load your personal payslips.")
    } finally {
      setIsLoading(false)
    }
  }, [page, request])

  useEffect(() => {
    void loadMyPayslips()
  }, [loadMyPayslips])

  const handleDownloadPdf = async (slip: Payslip) => {
    setDownloadingId(slip.id)
    setError(null)
    try {
      const blob = await request<Blob>(`/payslips/${slip.id}/pdf`, {
        responseType: "blob",
      })
      triggerBlobDownload(blob, `payslip-${slip.payslipNumber}.pdf`)
      setSuccessMessage(`Downloaded PDF for ${slip.payslipNumber}`)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to download your payslip PDF.")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleOpenDetails = async (slip: Payslip) => {
    setIsLoadingDetails(true)
    setViewPayslip(slip)
    try {
      const res = await request<{ data: Payslip }>(`/me/payslips/${slip.id}`)
      setViewPayslip(res.data)
    } catch (err: unknown) {
      console.error("Failed to load full payslip details", err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Payslips
          </h1>
          <p className="text-sm text-muted-foreground">
            View your personal earnings, deductions, and download official monthly
            pay slips.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadMyPayslips()}
          disabled={isLoading}
        >
          <RefreshCwIcon
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircleIcon className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          <CheckCircle2Icon className="h-4 w-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Employee Profile Banner */}
      {data?.employee && (
        <Card className="bg-muted/40">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Employee
                </p>
                <p className="text-base font-bold text-foreground">
                  {data.employee.firstName} {data.employee.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Employee Code:{" "}
                  <span className="font-mono font-medium">
                    {data.employee.employeeCode}
                  </span>{" "}
                  • {data.employee.workEmail}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Statements Issued
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {data.pagination.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payslips List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Compensation Statements
          </CardTitle>
          <CardDescription>
            Historical record of your monthly payroll payouts and statutory
            deductions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              title="No payslips available yet"
              description="Your compensation statements will appear here once payroll is processed and finalized by HR."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Statement #</th>
                    <th className="py-3 pr-4">Payroll Cycle</th>
                    <th className="py-3 pr-4 text-right">Gross Pay</th>
                    <th className="py-3 pr-4 text-right">Deductions</th>
                    <th className="py-3 pr-4 text-right">Take-Home (Net)</th>
                    <th className="py-3 pr-4 text-center">Status</th>
                    <th className="py-3 pr-4 text-center">Payment</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((slip) => (
                    <tr
                      key={slip.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      {/* Statement Number */}
                      <td className="py-3.5 pr-4 font-mono font-medium text-foreground">
                        {slip.payslipNumber}
                      </td>

                      {/* Period */}
                      <td className="py-3.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(slip.periodStart)} –{" "}
                        {formatDate(slip.periodEnd)}
                      </td>

                      {/* Financials */}
                      <td className="py-3.5 pr-4 text-right font-mono text-xs text-foreground">
                        {formatMoney(slip.grossAmount)}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-xs text-rose-600">
                        -{formatMoney(slip.totalDeductions)}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono font-semibold text-emerald-600">
                        {formatMoney(slip.netAmount)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 pr-4 text-center">
                        <StatusBadge status={slip.status} />
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 pr-4 text-center">
                        <StatusBadge status={slip.paymentStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleOpenDetails(slip)}
                            title="View statement breakdown"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDownloadPdf(slip)}
                            disabled={
                              downloadingId === slip.id ||
                              slip.status !== "FINAL"
                            }
                            title={
                              slip.status !== "FINAL"
                                ? "PDF available once finalized"
                                : "Download official PDF"
                            }
                          >
                            <DownloadIcon
                              className={`mr-1 h-3.5 w-3.5 ${
                                downloadingId === slip.id ? "animate-bounce" : ""
                              }`}
                            />
                            {downloadingId === slip.id ? "PDF..." : "PDF"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                  }
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statement Breakdown Dialog */}
      {viewPayslip && (
        <Dialog
          open={Boolean(viewPayslip)}
          onOpenChange={(open) => {
            if (!open) setViewPayslip(null)
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-primary" />
                <DialogTitle className="font-mono">
                  {viewPayslip.payslipNumber}
                </DialogTitle>
                <StatusBadge status={viewPayslip.status} />
              </div>
              <DialogDescription>
                Payroll Period: {formatDate(viewPayslip.periodStart)} –{" "}
                {formatDate(viewPayslip.periodEnd)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-border p-3 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Gross Earnings
                  </div>
                  <div className="font-mono font-semibold text-foreground">
                    {formatMoney(viewPayslip.grossAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Deductions
                  </div>
                  <div className="font-mono font-semibold text-rose-600">
                    -{formatMoney(viewPayslip.totalDeductions)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Net Take-Home
                  </div>
                  <div className="font-mono font-bold text-emerald-600">
                    {formatMoney(viewPayslip.netAmount)}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {isLoadingDetails ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Loading itemized breakdown...
                </div>
              ) : viewPayslip.lines && viewPayslip.lines.length > 0 ? (
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border font-semibold text-muted-foreground">
                        <th className="py-1.5 pr-2">Code</th>
                        <th className="py-1.5 pr-2">Description</th>
                        <th className="py-1.5 pr-2">Category</th>
                        <th className="py-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewPayslip.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-1.5 pr-2 font-mono font-medium">
                            {line.salaryRuleCode}
                          </td>
                          <td className="py-1.5 pr-2">{line.salaryRuleName}</td>
                          <td className="py-1.5 pr-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                line.category === "EARNING"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-rose-500/10 text-rose-600"
                              }`}
                            >
                              {line.category}
                            </span>
                          </td>
                          <td
                            className={`py-1.5 text-right font-mono font-medium ${
                              line.category === "EARNING"
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {line.category === "DEDUCTION" ? "-" : ""}
                            {formatMoney(line.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No line items detailed for this statement.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadPdf(viewPayslip)}
                disabled={
                  downloadingId === viewPayslip.id ||
                  viewPayslip.status !== "FINAL"
                }
              >
                <DownloadIcon className="mr-1 h-3.5 w-3.5" />
                {downloadingId === viewPayslip.id
                  ? "Downloading..."
                  : "Download PDF"}
              </Button>
              <DialogClose
                render={
                  <Button type="button" variant="default" size="sm">
                    Close
                  </Button>
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
