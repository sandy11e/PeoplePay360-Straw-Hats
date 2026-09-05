import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  MailIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
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
import type { PayrunListResponse, PayrunSummary } from "@/types/payroll"
import type {
  PaymentStatus,
  Payslip,
  PayslipListResponse,
} from "@/types/payslip"
import { triggerBlobDownload } from "@/utils/download"
import { formatDate, formatMoney } from "@/utils/format"

export function PayslipsPage() {
  const { request, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [payruns, setPayruns] = useState<PayrunSummary[]>([])
  const [selectedPayrunId, setSelectedPayrunId] = useState<string>(
    searchParams.get("payrunId") || "",
  )
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters & Pagination
  const [search, setSearch] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPayslips, setTotalPayslips] = useState(0)

  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [isBulkEmailOpen, setIsBulkEmailOpen] = useState(false)
  const [isBulkEmailing, setIsBulkEmailing] = useState(false)

  // Payment Status Dialog
  const [paymentStatusModalPayslip, setPaymentStatusModalPayslip] =
    useState<Payslip | null>(null)
  const [selectedPaymentStatus, setSelectedPaymentStatus] =
    useState<PaymentStatus>("PAID")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const isPayrollManagerOrAdmin =
    user?.role === "ADMIN" || user?.role === "PAYROLL_MANAGER"

  // Load payruns for selector
  const loadPayruns = useCallback(async () => {
    try {
      const res = await request<PayrunListResponse>("/payruns?pageSize=100")
      setPayruns(res.payruns)
      if (!selectedPayrunId && res.payruns.length > 0) {
        // Default to first payrun
        const defaultId = res.payruns[0].id
        setSelectedPayrunId(defaultId)
        setSearchParams({ payrunId: defaultId })
      }
    } catch (err) {
      console.error("Failed to load payruns for payslips filter", err)
    }
  }, [request, selectedPayrunId, setSearchParams])

  useEffect(() => {
    void loadPayruns()
  }, [loadPayruns])

  // Load payslips for selected payrun
  const loadPayslips = useCallback(async () => {
    if (!selectedPayrunId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      let url = `/payruns/${selectedPayrunId}/payslips?page=${page}&limit=15`
      if (paymentStatusFilter) {
        url += `&paymentStatus=${encodeURIComponent(paymentStatusFilter)}`
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`
      }

      const res = await request<PayslipListResponse>(url)
      setPayslips(res.data)
      setTotalPages(res.pagination.totalPages)
      setTotalPayslips(res.pagination.total)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to load payslips for this payrun.")
    } finally {
      setIsLoading(false)
    }
  }, [request, selectedPayrunId, page, paymentStatusFilter, search])

  useEffect(() => {
    void loadPayslips()
  }, [loadPayslips])

  const handlePayrunChange = (id: string) => {
    setSelectedPayrunId(id)
    setSearchParams({ payrunId: id })
    setPage(1)
  }

  // PDF Download
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
      setError(apiErr.message || "Failed to download payslip PDF.")
    } finally {
      setDownloadingId(null)
    }
  }

  // Single Email Delivery
  const handleSendEmail = async (slip: Payslip) => {
    setEmailingId(slip.id)
    setError(null)
    try {
      const res = await request<{ data: { recipient: string; status: string } }>(
        `/payslips/${slip.id}/email`,
        { method: "POST" },
      )
      setSuccessMessage(
        `Payslip email successfully dispatched to ${res.data.recipient}`,
      )
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to send payslip email.")
    } finally {
      setEmailingId(null)
    }
  }

  // Bulk Email Delivery for Payrun
  const handleBulkEmail = async () => {
    if (!selectedPayrunId) return
    setIsBulkEmailing(true)
    setError(null)
    try {
      const res = await request<{
        data: { total: number; sent: number; failed: number }
      }>(`/payruns/${selectedPayrunId}/email-payslips`, {
        method: "POST",
      })
      setIsBulkEmailOpen(false)
      setSuccessMessage(
        `Bulk delivery completed: ${res.data.sent} sent successfully, ${res.data.failed} failed out of ${res.data.total}.`,
      )
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to complete bulk payslip email delivery.")
    } finally {
      setIsBulkEmailing(false)
    }
  }

  // Update Payment Status
  const handleUpdatePaymentStatus = async (e: FormEvent) => {
    e.preventDefault()
    if (!paymentStatusModalPayslip) return

    setIsUpdatingStatus(true)
    setError(null)
    try {
      await request(`/payslips/${paymentStatusModalPayslip.id}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus: selectedPaymentStatus,
        }),
      })
      setSuccessMessage(
        `Payment status updated to ${selectedPaymentStatus} for ${paymentStatusModalPayslip.payslipNumber}`,
      )
      setPaymentStatusModalPayslip(null)
      void loadPayslips()
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to update payment status.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Payslips Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse, download official PDF statements, email, and manage payment
            disbursements.
          </p>
        </div>

        {isPayrollManagerOrAdmin && selectedPayrunId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBulkEmailOpen(true)}
              disabled={isLoading || payslips.length === 0}
            >
              <MailIcon className="mr-2 h-4 w-4" />
              Email All in Payrun
            </Button>
          </div>
        )}
      </div>

      {/* Alert Messages */}
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

      {/* Filter / Selector Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Payrun & Filter Selection
          </CardTitle>
          <CardDescription>
            Select a payroll cycle to view generated payslips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Payrun Selector */}
            <div>
              <label
                htmlFor="payrun-selector"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Payroll Cycle
              </label>
              <select
                id="payrun-selector"
                value={selectedPayrunId}
                onChange={(e) => handlePayrunChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {payruns.length === 0 && (
                  <option value="">No payruns found</option>
                )}
                {payruns.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.code} ({formatDate(pr.periodStart)} –{" "}
                    {formatDate(pr.periodEnd)}) — {pr.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label
                htmlFor="payment-filter"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Payment Status
              </label>
              <select
                id="payment-filter"
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Payment Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PROCESSING">Processing</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Employee Search */}
            <div>
              <label
                htmlFor="search-input"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Search Employee
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Name, code, or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payslips Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Payslips Register
            </CardTitle>
            <CardDescription>
              {totalPayslips} {totalPayslips === 1 ? "payslip" : "payslips"} found
              in this payrun
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadPayslips()}
            disabled={isLoading}
          >
            <RefreshCwIcon
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 w-full animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : payslips.length === 0 ? (
            <EmptyState
              title="No payslips found"
              description={
                selectedPayrunId
                  ? "No payslips have been generated for this payrun yet. Go to Payruns details to generate them."
                  : "Please select a payrun cycle above."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Payslip #</th>
                    <th className="py-3 pr-4">Employee</th>
                    <th className="py-3 pr-4">Period</th>
                    <th className="py-3 pr-4 text-right">Gross Pay</th>
                    <th className="py-3 pr-4 text-right">Deductions</th>
                    <th className="py-3 pr-4 text-right">Net Pay</th>
                    <th className="py-3 pr-4 text-center">Status</th>
                    <th className="py-3 pr-4 text-center">Payment</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payslips.map((slip) => (
                    <tr
                      key={slip.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      {/* Payslip Number */}
                      <td className="py-3.5 pr-4 font-mono font-medium text-foreground">
                        <Link
                          to={`/payslips/${slip.id}`}
                          className="hover:underline hover:text-primary"
                        >
                          {slip.payslipNumber}
                        </Link>
                      </td>

                      {/* Employee Info */}
                      <td className="py-3.5 pr-4">
                        <div className="font-medium text-foreground">
                          {slip.employee.firstName} {slip.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {slip.employee.employeeCode} •{" "}
                          {slip.employee.department?.name || "General"}
                        </div>
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

                      {/* Payment Status */}
                      <td className="py-3.5 pr-4 text-center">
                        <StatusBadge status={slip.paymentStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link to={`/payslips/${slip.id}`} />}
                            title="View payslip details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>

                          {/* PDF Download */}
                          <Button
                            variant="ghost"
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
                              className={`h-4 w-4 ${
                                downloadingId === slip.id ? "animate-bounce" : ""
                              }`}
                            />
                          </Button>

                          {/* Email delivery */}
                          {isPayrollManagerOrAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleSendEmail(slip)}
                              disabled={
                                emailingId === slip.id ||
                                slip.status !== "FINAL"
                              }
                              title={
                                slip.status !== "FINAL"
                                  ? "Email available once finalized"
                                  : "Email payslip PDF to employee"
                              }
                            >
                              <SendIcon
                                className={`h-4 w-4 ${
                                emailingId === slip.id ? "animate-pulse" : ""
                              }`}
                            />
                            </Button>
                          )}

                          {/* Payment status change */}
                          {isPayrollManagerOrAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setPaymentStatusModalPayslip(slip)
                                setSelectedPaymentStatus(slip.paymentStatus)
                              }}
                            >
                              Payment
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Email Confirmation Dialog */}
      <ConfirmDialog
        open={isBulkEmailOpen}
        onOpenChange={setIsBulkEmailOpen}
        title="Email All Payrun Payslips"
        description="This will send individual emails with PDF payslips attached to all employees in this payrun. Are you sure you want to proceed?"
        confirmLabel={isBulkEmailing ? "Sending Emails..." : "Send All Payslips"}
        variant="default"
        onConfirm={() => void handleBulkEmail()}
      />

      {/* Update Payment Status Dialog */}
      {paymentStatusModalPayslip && (
        <Dialog
          open={Boolean(paymentStatusModalPayslip)}
          onOpenChange={(open) => {
            if (!open) setPaymentStatusModalPayslip(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Payment Disbursement</DialogTitle>
              <DialogDescription>
                Record payment disbursement status for{" "}
                <span className="font-semibold text-foreground">
                  {paymentStatusModalPayslip.payslipNumber}
                </span>{" "}
                (
                {paymentStatusModalPayslip.employee.firstName}{" "}
                {paymentStatusModalPayslip.employee.lastName}
                ).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdatePaymentStatus} className="space-y-4">
              <div>
                <label
                  htmlFor="status-select"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Payment Status
                </label>
                <select
                  id="status-select"
                  value={selectedPaymentStatus}
                  onChange={(e) =>
                    setSelectedPaymentStatus(e.target.value as PaymentStatus)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="UNPAID">UNPAID — Not yet disbursed</option>
                  <option value="PROCESSING">
                    PROCESSING — Bank transfer initiated
                  </option>
                  <option value="PAID">PAID — Confirmed settled</option>
                  <option value="FAILED">FAILED — Bank bounce / issue</option>
                </select>
              </div>

              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Total Net Amount to Disburse:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatMoney(paymentStatusModalPayslip.netAmount)}
                </span>
              </div>

              <DialogFooter>
                <DialogClose
                  render={
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  }
                />
                <Button type="submit" disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? "Updating..." : "Save Payment Status"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
