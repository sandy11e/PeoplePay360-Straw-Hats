import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  MailIcon,
} from "lucide-react"

import { useAuth } from "@/auth/auth-context"
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
import type { PaymentStatus, Payslip } from "@/types/payslip"
import { triggerBlobDownload } from "@/utils/download"
import { formatDate, formatMoney } from "@/utils/format"

export function PayslipDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { request, user } = useAuth()

  const [payslip, setPayslip] = useState<Payslip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Actions
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  // Payment status modal
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false)
  const [selectedPaymentStatus, setSelectedPaymentStatus] =
    useState<PaymentStatus>("PAID")
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  const isPayrollManagerOrAdmin =
    user?.role === "ADMIN" || user?.role === "PAYROLL_MANAGER"

  const loadPayslip = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      // If employee, use /me/payslips/:id or /payslips/:id (backend getPayslipById allows self access)
      const res = await request<{ data: Payslip }>(`/payslips/${id}`)
      setPayslip(res.data)
      setSelectedPaymentStatus(res.data.paymentStatus)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to load payslip record.")
    } finally {
      setIsLoading(false)
    }
  }, [id, request])

  useEffect(() => {
    void loadPayslip()
  }, [loadPayslip])

  // PDF Download
  const handleDownloadPdf = async () => {
    if (!payslip) return
    setIsDownloadingPdf(true)
    setError(null)
    try {
      const blob = await request<Blob>(`/payslips/${payslip.id}/pdf`, {
        responseType: "blob",
      })
      triggerBlobDownload(blob, `payslip-${payslip.payslipNumber}.pdf`)
      setSuccessMessage(`Official PDF downloaded for ${payslip.payslipNumber}`)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to generate or download payslip PDF.")
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Email delivery
  const handleSendEmail = async () => {
    if (!payslip) return
    setIsSendingEmail(true)
    setError(null)
    try {
      const res = await request<{ data: { recipient: string; status: string } }>(
        `/payslips/${payslip.id}/email`,
        { method: "POST" },
      )
      setSuccessMessage(
        `Payslip statement successfully emailed to ${res.data.recipient}`,
      )
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to send payslip email.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  // Update payment status
  const handleSavePaymentStatus = async (e: FormEvent) => {
    e.preventDefault()
    if (!payslip) return
    setIsSavingStatus(true)
    setError(null)
    try {
      await request(`/payslips/${payslip.id}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus: selectedPaymentStatus,
        }),
      })
      setIsPaymentStatusOpen(false)
      setSuccessMessage(
        `Payment disbursement status updated to ${selectedPaymentStatus}`,
      )
      void loadPayslip()
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError(apiErr.message || "Failed to update payment status.")
    } finally {
      setIsSavingStatus(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!payslip) {
    return (
      <div className="space-y-4 py-8 text-center">
        <AlertCircleIcon className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Payslip Record Not Found</h2>
        <p className="text-sm text-muted-foreground">
          {error || "The requested payslip could not be retrieved."}
        </p>
        <Button variant="outline" render={<Link to="/payslips" />}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Payslips
        </Button>
      </div>
    )
  }

  // Split lines into earnings and deductions
  const lines = payslip.lines || []
  const earningLines = lines.filter((l) => l.category === "EARNING")
  const deductionLines = lines.filter((l) => l.category === "DEDUCTION")

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/payslips" />}
            title="Return to Payslips"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {payslip.payslipNumber}
              </h1>
              <StatusBadge status={payslip.status} />
              <StatusBadge status={payslip.paymentStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              Period: {formatDate(payslip.periodStart)} –{" "}
              {formatDate(payslip.periodEnd)} • Payrun{" "}
              <span className="font-mono font-medium">
                {payslip.payrun?.code || payslip.payrunId}
              </span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF Download */}
          <Button
            variant="outline"
            onClick={() => void handleDownloadPdf()}
            disabled={isDownloadingPdf || payslip.status !== "FINAL"}
            title={
              payslip.status !== "FINAL"
                ? "PDF can only be generated for finalized payslips."
                : "Download official PDF"
            }
          >
            <DownloadIcon
              className={`mr-2 h-4 w-4 ${
                isDownloadingPdf ? "animate-bounce" : ""
              }`}
            />
            {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
          </Button>

          {/* Email Payslip */}
          {isPayrollManagerOrAdmin && (
            <Button
              variant="outline"
              onClick={() => void handleSendEmail()}
              disabled={isSendingEmail || payslip.status !== "FINAL"}
              title={
                payslip.status !== "FINAL"
                  ? "Email can only be sent for finalized payslips."
                  : "Dispatch email with PDF attachment"
              }
            >
              <MailIcon
                className={`mr-2 h-4 w-4 ${
                  isSendingEmail ? "animate-pulse" : ""
                }`}
              />
              {isSendingEmail ? "Sending..." : "Email Payslip"}
            </Button>
          )}

          {/* Update Payment Status */}
          {isPayrollManagerOrAdmin && (
            <Button
              variant="default"
              onClick={() => setIsPaymentStatusOpen(true)}
            >
              Update Payment Status
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
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

      {/* Employee Context Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Employee
              </span>
              <p className="mt-1 font-semibold text-foreground">
                {payslip.employee.firstName} {payslip.employee.middleName || ""}{" "}
                {payslip.employee.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                Code: {payslip.employee.employeeCode}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {payslip.employee.workEmail}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Department
              </span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {payslip.employee.department?.name || "General"}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Job Position
              </span>
              <p className="mt-1 text-sm font-medium text-foreground">
                {payslip.employee.jobPosition?.title || "Not Assigned"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Base Salary */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase">
              Base Salary
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-foreground">
              {formatMoney(payslip.baseSalary)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              Contractual baseline
            </span>
          </CardContent>
        </Card>

        {/* Gross Pay */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase">
              Gross Earnings
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-foreground">
              {formatMoney(payslip.grossAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              Base + all additions
            </span>
          </CardContent>
        </Card>

        {/* Total Deductions */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase">
              Total Deductions
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-rose-600">
              -{formatMoney(payslip.totalDeductions)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              Taxes, PF & withholdings
            </span>
          </CardContent>
        </Card>

        {/* Net Take-Home Pay */}
        <Card className="border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
              Net Take-Home Pay
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-emerald-600 dark:text-emerald-400">
              {formatMoney(payslip.netAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Disbursement amount
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Breakdown: Earnings & Deductions side-by-side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Earnings Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                Earnings Breakdown
              </CardTitle>
              <span className="font-mono text-sm font-semibold text-emerald-600">
                {formatMoney(payslip.grossAmount)}
              </span>
            </div>
            <CardDescription>
              All income line items included in this period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Seq</th>
                    <th className="py-2 pr-3">Rule Code</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {earningLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 text-center text-xs text-muted-foreground"
                      >
                        No earning items recorded.
                      </td>
                    </tr>
                  ) : (
                    earningLines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/30">
                        <td className="py-2.5 pr-3 text-xs font-mono text-muted-foreground">
                          {line.sequence}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs font-medium text-foreground">
                          {line.salaryRuleCode}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-foreground">
                          {line.salaryRuleName}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs font-medium text-emerald-600">
                          {formatMoney(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Deductions Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-rose-700 dark:text-rose-400">
                Deductions Breakdown
              </CardTitle>
              <span className="font-mono text-sm font-semibold text-rose-600">
                -{formatMoney(payslip.totalDeductions)}
              </span>
            </div>
            <CardDescription>
              Statutory withholdings, taxes, and other deductions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Seq</th>
                    <th className="py-2 pr-3">Rule Code</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deductionLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 text-center text-xs text-muted-foreground"
                      >
                        No deduction items recorded.
                      </td>
                    </tr>
                  ) : (
                    deductionLines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/30">
                        <td className="py-2.5 pr-3 text-xs font-mono text-muted-foreground">
                          {line.sequence}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs font-medium text-foreground">
                          {line.salaryRuleCode}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-foreground">
                          {line.salaryRuleName}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs font-medium text-rose-600">
                          -{formatMoney(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Modal */}
      <Dialog open={isPaymentStatusOpen} onOpenChange={setIsPaymentStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Disbursement</DialogTitle>
            <DialogDescription>
              Change payment status for {payslip.payslipNumber} (
              {payslip.employee.firstName} {payslip.employee.lastName}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePaymentStatus} className="space-y-4">
            <div>
              <label
                htmlFor="modal-payment-status"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Payment Status
              </label>
              <select
                id="modal-payment-status"
                value={selectedPaymentStatus}
                onChange={(e) =>
                  setSelectedPaymentStatus(e.target.value as PaymentStatus)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="UNPAID">UNPAID — Not yet disbursed</option>
                <option value="PROCESSING">
                  PROCESSING — Bank transfer in progress
                </option>
                <option value="PAID">PAID — Confirmed settled</option>
                <option value="FAILED">FAILED — Payment bounced / error</option>
              </select>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Total Net Payable:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatMoney(payslip.netAmount)}
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
              <Button type="submit" disabled={isSavingStatus}>
                {isSavingStatus ? "Saving..." : "Save Status"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
