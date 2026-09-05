import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CoinsIcon,
  FileCheckIcon,
  MailIcon,
  UsersIcon,
  XCircleIcon,
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

interface PayrunDetail {
  id: string
  code: string
  periodStart: string
  periodEnd: string
  status: string
  employeeCount: number
  totalGross: string | null
  totalDeductions: string | null
  totalNet: string | null
  calculatedAt: string | null
  validatedAt: string | null
}

interface PayrunDetailResponse {
  payrun: PayrunDetail
}

interface CalculationLine {
  id: string
  salaryRuleCode: string
  salaryRuleName: string
  category: "EARNING" | "DEDUCTION"
  amount: number
  sequence: number
}

interface CalculationEmployee {
  id: string
  employeeId: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
  }
  contractBaseSalary: string
  totalGross: string
  totalDeductions: string
  netSalary: string
  warningCount: number
  warnings: string[]
  lines: CalculationLine[]
}

interface CalculationsResponse {
  calculations: CalculationEmployee[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function PayrunDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { request, user } = useAuth()
  const canManage = canManagePayroll(user?.role)

  const [payrun, setPayrun] = useState<PayrunDetail | null>(null)
  const [calculations, setCalculations] = useState<CalculationEmployee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Confirmation modals
  const [validateModalOpen, setValidateModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [generatePayslipsModalOpen, setGeneratePayslipsModalOpen] = useState(false)
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false)

  // Line item breakdown modal
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false)
  const [selectedCalc, setSelectedCalc] = useState<CalculationEmployee | null>(null)

  const loadPayrunData = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [payrunRes, calcRes] = await Promise.all([
        request<PayrunDetailResponse>(`/payruns/${id}`),
        request<CalculationsResponse>(`/payruns/${id}/calculations`).catch(() => ({
          calculations: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        })),
      ])

      setPayrun(payrunRes.payrun)
      setCalculations(calcRes.calculations)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load payrun details")
    } finally {
      setIsLoading(false)
    }
  }, [id, request])

  useEffect(() => {
    void loadPayrunData()
  }, [loadPayrunData])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function handleCalculate() {
    if (!id) return
    try {
      setIsProcessing(true)
      setErrorMessage(null)
      await request(`/payruns/${id}/calculate`, { method: "POST" })
      setSuccessMessage("Payroll calculations executed successfully across enrolled personnel")
      void loadPayrunData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to calculate payroll")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleValidate() {
    if (!id) return
    try {
      setIsProcessing(true)
      setErrorMessage(null)
      await request(`/payruns/${id}/validate`, { method: "POST" })
      setSuccessMessage("Payroll run officially VALIDATED and locked as immutable record")
      void loadPayrunData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to validate payroll run")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleCancelPayrun() {
    if (!id) return
    try {
      setIsProcessing(true)
      setErrorMessage(null)
      await request(`/payruns/${id}/cancel`, { method: "POST" })
      setSuccessMessage("Payrun cancelled")
      void loadPayrunData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel payrun")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleGeneratePayslips() {
    if (!id) return
    try {
      setIsProcessing(true)
      setErrorMessage(null)
      await request(`/payruns/${id}/payslips`, { method: "POST" })
      setSuccessMessage("Payslip records generated successfully with immutable snapshot lines!")
      void loadPayrunData()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate payslips")
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleBulkEmail() {
    if (!id) return
    try {
      setIsProcessing(true)
      setErrorMessage(null)
      const res = await request<{ summary: { total: number; successful: number; failed: number } }>(
        `/payruns/${id}/email-payslips`,
        { method: "POST" },
      )
      setSuccessMessage(
        `Payslip email dispatch completed: ${res.summary.successful} sent, ${res.summary.failed} failed.`,
      )
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send payslip emails")
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading payrun details...</p>
      </div>
    )
  }

  if (!payrun) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" render={<Link to="/payruns" />}>
          <ArrowLeftIcon className="mr-2 size-4" /> Back to Payruns
        </Button>
        <EmptyState title="Payrun not found" description="The requested payrun period does not exist." />
      </div>
    )
  }

  const totalWarnings = calculations.reduce((sum, c) => sum + (c.warningCount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/payruns" />} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          <span>Back to Payroll Runs</span>
        </Button>
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

      {/* Payrun Control Banner */}
      <Card className="shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                  {payrun.code}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Period: {formatDate(payrun.periodStart)} → {formatDate(payrun.periodEnd)}
                </h1>
                <StatusBadge status={payrun.status} category="payrun" />
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {payrun.validatedAt
                  ? `Validated and sealed on ${formatDate(payrun.validatedAt)}`
                  : payrun.calculatedAt
                  ? `Calculated on ${formatDate(payrun.calculatedAt)}. Ready for auditing and validation.`
                  : "Payrun initiated in DRAFT state. Calculate to generate compensation results."}
              </p>
            </div>

            {/* Action Buttons */}
            {canManage && payrun.status !== "CANCELLED" && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Calculate */}
                {payrun.status !== "VALIDATED" && (
                  <Button
                    onClick={() => void handleCalculate()}
                    disabled={isProcessing}
                    className="gap-2 shadow-xs"
                  >
                    <CalculatorIcon className="size-4" />
                    <span>{isProcessing ? "Calculating..." : "Calculate Payroll"}</span>
                  </Button>
                )}

                {/* Validate (requires calculated) */}
                {payrun.status === "CALCULATED" && (
                  <Button
                    variant="outline"
                    onClick={() => setValidateModalOpen(true)}
                    disabled={isProcessing}
                    className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <FileCheckIcon className="size-4" />
                    <span>Validate Payroll</span>
                  </Button>
                )}

                {/* Generate Payslips (requires validated) */}
                {payrun.status === "VALIDATED" && (
                  <>
                    <Button
                      onClick={() => setGeneratePayslipsModalOpen(true)}
                      disabled={isProcessing}
                      className="gap-2 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CoinsIcon className="size-4" />
                      <span>Generate Payslips</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setBulkEmailModalOpen(true)}
                      disabled={isProcessing}
                      className="gap-2"
                    >
                      <MailIcon className="size-4" />
                      <span>Email All Payslips</span>
                    </Button>
                  </>
                )}

                {/* Cancel Payrun */}
                {payrun.status !== "VALIDATED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelModalOpen(true)}
                    disabled={isProcessing}
                    className="text-rose-600 hover:bg-rose-500/10"
                  >
                    <XCircleIcon className="size-4" />
                    <span>Cancel</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <UsersIcon className="size-3.5 text-primary" /> Enrolled Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{payrun.employeeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Calculated employees</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              Gross Payroll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {payrun.totalGross ? formatMoney(payrun.totalGross) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Earnings before deductions</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              Total Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {payrun.totalDeductions ? formatMoney(payrun.totalDeductions) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Taxes & deductions</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              Net Disbursable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {payrun.totalNet ? formatMoney(payrun.totalNet) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Final payroll expenditure</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangleIcon className="size-3.5 text-amber-500" /> Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalWarnings > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              }`}
            >
              {totalWarnings}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Validation notices</p>
          </CardContent>
        </Card>
      </div>

      {/* Calculations Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Employee Calculation Breakdown</CardTitle>
          <CardDescription>
            Itemized earning and deduction totals computed per employee contract & salary structure.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Employee</TableHead>
                  <TableHead>Base Wage</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Audit Notices</TableHead>
                  <TableHead className="text-right">Breakdown</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {calculations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <EmptyState
                        title="No calculations available"
                        description={
                          payrun.status === "DRAFT"
                            ? 'Click "Calculate Payroll" above to compute earnings for all active personnel.'
                            : "No employees matched the eligibility criteria for this period."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  calculations.map((calc) => (
                    <TableRow key={calc.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {calc.employee.firstName} {calc.employee.lastName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {calc.employee.employeeCode}
                        </p>
                      </TableCell>

                      <TableCell className="text-sm font-medium">
                        {formatMoney(calc.contractBaseSalary)}
                      </TableCell>

                      <TableCell className="text-sm font-medium">
                        {formatMoney(calc.totalGross)}
                      </TableCell>

                      <TableCell className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        {formatMoney(calc.totalDeductions)}
                      </TableCell>

                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(calc.netSalary)}
                      </TableCell>

                      <TableCell>
                        {calc.warningCount > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            title={calc.warnings.join("; ")}
                          >
                            <AlertTriangleIcon className="size-3" />
                            {calc.warningCount} notice{calc.warningCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2Icon className="size-3 text-emerald-500" />
                            Clean
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCalc(calc)
                            setBreakdownModalOpen(true)
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          View Lines
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* LINE ITEMS BREAKDOWN MODAL */}
      <Dialog open={breakdownModalOpen} onOpenChange={setBreakdownModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Itemized Payroll Calculation Lines</DialogTitle>
            <DialogDescription>
              Snapshot output rules for{" "}
              <span className="font-semibold text-foreground">
                {selectedCalc?.employee.firstName} {selectedCalc?.employee.lastName}
              </span>{" "}
              ({selectedCalc?.employee.employeeCode}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12">Seq</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCalc?.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{line.sequence}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {line.salaryRuleName} ({line.salaryRuleCode})
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            line.category === "EARNING"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {line.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedCalc?.warnings && selectedCalc.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangleIcon className="size-3.5" /> Calculation Notices:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {selectedCalc.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="pt-2">
              <DialogClose render={<Button variant="outline">Close</Button>} />
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* VALIDATE IMMUTABLE CONFIRMATION MODAL */}
      <ConfirmDialog
        open={validateModalOpen}
        onOpenChange={setValidateModalOpen}
        title="Validate Payroll Run"
        description="WARNING: Validating this payroll run permanently locks all employee wage figures, earnings, and deduction amounts as an immutable record. Future modifications to contracts or salary rules will not affect this payroll period."
        confirmLabel="Lock & Validate"
        onConfirm={handleValidate}
      />

      {/* CANCEL CONFIRMATION */}
      <ConfirmDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Payrun"
        description="Are you sure you want to cancel this payroll cycle? Calculations will be discarded."
        variant="destructive"
        confirmLabel="Cancel Payrun"
        onConfirm={handleCancelPayrun}
      />

      {/* GENERATE PAYSLIPS MODAL */}
      <ConfirmDialog
        open={generatePayslipsModalOpen}
        onOpenChange={setGeneratePayslipsModalOpen}
        title="Generate Official Payslips"
        description="This will snapshot immutable payslip records with individual rule lines for all eligible employees in this validated payrun."
        confirmLabel="Generate Payslips"
        onConfirm={handleGeneratePayslips}
      />

      {/* BULK EMAIL MODAL */}
      <ConfirmDialog
        open={bulkEmailModalOpen}
        onOpenChange={setBulkEmailModalOpen}
        title="Email All Payrun Payslips"
        description="Send PDF payslip notification emails to all enrolled employees with valid work email addresses. Continue dispatching?"
        confirmLabel="Send Emails"
        onConfirm={handleBulkEmail}
      />
    </div>
  )
}
