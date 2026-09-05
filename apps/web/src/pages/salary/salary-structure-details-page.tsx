import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  PlusIcon,
  Trash2Icon,
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
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney } from "@/utils/format"
import { canManagePayroll } from "@/utils/roles"

interface SalaryRuleRecord {
  id: string
  code: string
  name: string
  category: "EARNING" | "DEDUCTION"
  calculationType: "FIXED" | "PERCENTAGE"
  amount: number | null
  percentage: number | null
  base: "BASE_SALARY" | "GROSS_EARNINGS" | null
  sequence: number
  isTaxable: boolean
  isActive: boolean
}

interface SalaryStructureDetail {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  rules: SalaryRuleRecord[]
}

interface StructureDetailResponse {
  salaryStructure: SalaryStructureDetail
}

export function SalaryStructureDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { request, user } = useAuth()
  const canManage = canManagePayroll(user?.role)

  const [structure, setStructure] = useState<SalaryStructureDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Add Rule Modal state
  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [sequence, setSequence] = useState("1")
  const [ruleCode, setRuleCode] = useState("")
  const [ruleName, setRuleName] = useState("")
  const [category, setCategory] = useState<"EARNING" | "DEDUCTION">("EARNING")
  const [calculationType, setCalculationType] = useState<"FIXED" | "PERCENTAGE">("PERCENTAGE")
  const [fixedAmount, setFixedAmount] = useState("0")
  const [percentageVal, setPercentageVal] = useState("50")
  const [baseTarget, setBaseTarget] = useState<"BASE_SALARY" | "GROSS_EARNINGS">("BASE_SALARY")
  const [isTaxable, setIsTaxable] = useState(true)
  const [isSubmittingRule, setIsSubmittingRule] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  // Delete Rule Confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<SalaryRuleRecord | null>(null)

  const loadStructure = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const res = await request<StructureDetailResponse>(`/salary-structures/${id}`)
      setStructure(res.salaryStructure)
      // Set next sequence by default
      const maxSeq = res.salaryStructure.rules.reduce((max, r) => Math.max(max, r.sequence), 0)
      setSequence((maxSeq + 1).toString())
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load salary structure details")
    } finally {
      setIsLoading(false)
    }
  }, [id, request])

  useEffect(() => {
    void loadStructure()
  }, [loadStructure])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openAddRuleModal() {
    setRuleCode("")
    setRuleName("")
    setCategory("EARNING")
    setCalculationType("PERCENTAGE")
    setFixedAmount("0")
    setPercentageVal("10")
    setBaseTarget("BASE_SALARY")
    setIsTaxable(true)
    setRuleError(null)
    setAddRuleOpen(true)
  }

  async function handleAddRule(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setRuleError(null)
    setErrorMessage(null)

    try {
      setIsSubmittingRule(true)

      const body: Record<string, unknown> = {
        code: ruleCode.trim().toUpperCase(),
        name: ruleName,
        category,
        calculationType,
        sequence: parseInt(sequence) || 1,
        isTaxable,
        isActive: true,
      }

      if (calculationType === "FIXED") {
        body.amount = parseFloat(fixedAmount)
        body.percentage = null
        body.base = null
      } else {
        body.percentage = parseFloat(percentageVal)
        body.base = baseTarget
        body.amount = null
      }

      await request(`/salary-structures/${id}/rules`, {
        method: "POST",
        body,
      })

      setSuccessMessage(`Salary rule "${ruleName}" added successfully`)
      setAddRuleOpen(false)
      void loadStructure()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add salary rule"
      setRuleError(msg)
    } finally {
      setIsSubmittingRule(false)
    }
  }

  async function handleDeleteRule() {
    if (!id || !ruleToDelete) return

    try {
      await request(`/salary-structures/${id}/rules/${ruleToDelete.id}`, {
        method: "DELETE",
      })

      setSuccessMessage(`Rule "${ruleToDelete.name}" removed`)
      void loadStructure()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete salary rule")
    } finally {
      setRuleToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading salary structure...</p>
      </div>
    )
  }

  if (!structure) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" render={<Link to="/salary-structures" />}>
          <ArrowLeftIcon className="mr-2 size-4" /> Back to Structures
        </Button>
        <EmptyState title="Structure not found" description="The requested salary template does not exist." />
      </div>
    )
  }

  const sortedRules = [...structure.rules].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/salary-structures" />} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          <span>Back to Salary Structures</span>
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

      {/* Header Banner Card */}
      <Card className="shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                  {structure.code}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{structure.name}</h1>
                <StatusBadge status={structure.isActive ? "ACTIVE" : "INACTIVE"} category="general" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {structure.description || "No description provided for this salary structure template."}
              </p>
            </div>

            {canManage && (
              <Button onClick={openAddRuleModal} className="gap-2 shadow-xs">
                <PlusIcon className="size-4" />
                <span>Add Salary Rule</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rules Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Compensation Rules Sequence</CardTitle>
          <CardDescription>
            Rules are evaluated deterministically in ascending sequence order during payroll calculations.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-16">Seq</TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate / Amount</TableHead>
                  <TableHead>Base Target</TableHead>
                  <TableHead>Taxable</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 9 : 8} className="h-48">
                      <EmptyState
                        title="No salary rules defined"
                        description="Add earning allowances or deduction rules to make this salary structure operational."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRules.map((r) => (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                        #{r.sequence}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {r.code}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.category === "EARNING"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {r.category}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {r.calculationType}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {r.calculationType === "PERCENTAGE"
                          ? `${r.percentage}%`
                          : formatMoney(r.amount, "USD")}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {r.base ? r.base.replace(/_/g, " ") : "Fixed"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {r.isTaxable ? (
                          <span className="text-foreground">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>

                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRuleToDelete(r)
                              setDeleteConfirmOpen(true)
                            }}
                            className="h-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 px-2"
                            title="Delete salary rule"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ADD SALARY RULE MODAL */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Compensation Rule</DialogTitle>
            <DialogDescription>
              Define a declarative earning or deduction rule for this salary structure.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddRule} className="space-y-4 py-2">
            {ruleError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
                <AlertCircleIcon className="size-4 shrink-0" />
                <span>{ruleError}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-seq">Sequence</Label>
                <Input
                  id="r-seq"
                  type="number"
                  min="1"
                  required
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="r-code">Rule Code</Label>
                <Input
                  id="r-code"
                  required
                  placeholder="e.g. BASIC, HRA, TAX"
                  value={ruleCode}
                  onChange={(e) => setRuleCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-name">Rule Name</Label>
              <Input
                id="r-name"
                required
                placeholder="e.g. Basic Salary, Housing Allowance"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-cat">Category</Label>
                <select
                  id="r-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "EARNING" | "DEDUCTION")}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="EARNING">EARNING</option>
                  <option value="DEDUCTION">DEDUCTION</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="r-type">Calculation Type</Label>
                <select
                  id="r-type"
                  value={calculationType}
                  onChange={(e) => setCalculationType(e.target.value as "FIXED" | "PERCENTAGE")}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="PERCENTAGE">PERCENTAGE</option>
                  <option value="FIXED">FIXED</option>
                </select>
              </div>
            </div>

            {calculationType === "PERCENTAGE" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-pct">Rate Percentage (%)</Label>
                  <Input
                    id="r-pct"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    required
                    value={percentageVal}
                    onChange={(e) => setPercentageVal(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="r-base">Base Target</Label>
                  <select
                    id="r-base"
                    value={baseTarget}
                    onChange={(e) =>
                      setBaseTarget(e.target.value as "BASE_SALARY" | "GROSS_EARNINGS")
                    }
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="BASE_SALARY">Base Salary</option>
                    <option value="GROSS_EARNINGS">Gross Earnings</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="r-amt">Fixed Amount ($)</Label>
                <Input
                  id="r-amt"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="r-tax"
                checked={isTaxable}
                onChange={(e) => setIsTaxable(e.target.checked)}
                className="size-4 rounded-sm border border-input text-primary"
              />
              <Label htmlFor="r-tax" className="cursor-pointer text-sm font-normal">
                Subject to Tax Assessment
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isSubmittingRule} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmittingRule}>
                {isSubmittingRule ? "Saving..." : "Add Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Salary Rule"
        description={`Are you sure you want to remove rule "${ruleToDelete?.name}" (${ruleToDelete?.code})? This rule will no longer be included in future payroll calculations.`}
        variant="destructive"
        confirmLabel="Delete Rule"
        onConfirm={handleDeleteRule}
      />
    </div>
  )
}
