import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileCheckIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
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
import type { Employee, EmployeeListResponse } from "@/types/hr"
import { formatDate, formatMoney } from "@/utils/format"
import { isHr } from "@/utils/roles"

interface ContractRecord {
  id: string
  contractNumber: string
  employeeId: string
  employee: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    workEmail: string
  }
  startDate: string
  endDate: string | null
  baseSalary: string
  currency: string
  status: string
  notes: string | null
  createdAt: string
}

interface ContractListResponse {
  contracts: ContractRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function ContractsPage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Create form inputs
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [contractNumber, setContractNumber] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState("")
  const [baseSalary, setBaseSalary] = useState("50000")
  const [currency, setCurrency] = useState("USD")
  const [notes, setNotes] = useState("")

  // Status transition modal
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [targetContract, setTargetContract] = useState<ContractRecord | null>(null)
  const [targetStatus, setTargetStatus] = useState<string>("ACTIVE")

  const fetchContracts = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      let url = `/contracts?page=${page}&pageSize=${pageSize}`
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`
      }

      const res = await request<ContractListResponse>(url)
      setContracts(res.contracts)
      setTotalPages(res.pagination.totalPages)
      setTotalCount(res.pagination.total)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load contracts")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, request, statusFilter])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await request<EmployeeListResponse>("/employees?page=1&pageSize=100")
      setEmployees(res.employees)
    } catch (err) {
      console.error("Failed to load employees for contract form", err)
    }
  }, [request])

  useEffect(() => {
    void fetchContracts()
  }, [fetchContracts])

  useEffect(() => {
    if (canManage) {
      void fetchEmployees()
    }
  }, [canManage, fetchEmployees])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateModal() {
    setSelectedEmployeeId(employees[0]?.id || "")
    setContractNumber(`CNT-${Date.now().toString().slice(-6)}`)
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate("")
    setBaseSalary("50000")
    setCurrency("USD")
    setNotes("")
    setCreateOpen(true)
  }

  async function handleCreateContract(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedEmployeeId) {
      setErrorMessage("Please select an employee")
      return
    }

    try {
      setIsCreating(true)
      await request("/contracts", {
        method: "POST",
        body: {
          employeeId: selectedEmployeeId,
          contractNumber: contractNumber.trim().toUpperCase(),
          startDate,
          endDate: endDate ? endDate : null,
          baseSalary: parseFloat(baseSalary),
          currency: currency.toUpperCase(),
          notes: notes || null,
        },
      })

      setSuccessMessage(`Contract ${contractNumber} registered successfully`)
      setCreateOpen(false)
      void fetchContracts()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to register contract")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdateStatus() {
    if (!targetContract) return

    try {
      await request(`/contracts/${targetContract.id}/status`, {
        method: "PATCH",
        body: { status: targetStatus },
      })

      setSuccessMessage(`Contract ${targetContract.contractNumber} status updated to ${targetStatus}`)
      void fetchContracts()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update contract status")
    } finally {
      setTargetContract(null)
    }
  }

  const filteredContracts = contracts.filter((c) => {
    const query = searchTerm.toLowerCase()
    return (
      c.contractNumber.toLowerCase().includes(query) ||
      c.employee.firstName.toLowerCase().includes(query) ||
      c.employee.lastName.toLowerCase().includes(query) ||
      c.employee.employeeCode.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Employee Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Wage terms, employment conditions, and legally binding contract agreements.
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreateModal} className="gap-2 shadow-xs">
            <PlusIcon className="size-4" />
            <span>Create Contract</span>
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

      {/* Main Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Contract Register</CardTitle>
              <CardDescription>
                {totalCount} total contract agreement{totalCount === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search contract, employee..."
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
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
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
                  <TableHead className="w-28">Contract #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Effective Period</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={canManage ? 6 : 5} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="h-48">
                      <EmptyState
                        title="No contracts found"
                        description={
                          searchTerm || statusFilter !== "ALL"
                            ? "No contracts match your search filters."
                            : "No employee contracts created yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((c) => (
                    <TableRow key={c.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {c.contractNumber}
                      </TableCell>

                      <TableCell>
                        <p className="font-medium text-foreground">
                          {c.employee.firstName} {c.employee.lastName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{c.employee.employeeCode}</p>
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        {formatMoney(c.baseSalary, c.currency)}
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : "Indefinite"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.status} category="contract" />
                      </TableCell>

                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === "DRAFT" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setTargetContract(c)
                                  setTargetStatus("ACTIVE")
                                  setStatusConfirmOpen(true)
                                }}
                                className="h-7 gap-1 px-2 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                              >
                                <FileCheckIcon className="size-3.5" />
                                <span>Activate</span>
                              </Button>
                            )}

                            {c.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTargetContract(c)
                                  setTargetStatus("TERMINATED")
                                  setStatusConfirmOpen(true)
                                }}
                                className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-500/10"
                              >
                                <ShieldAlertIcon className="size-3.5" />
                                <span>Terminate</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
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

      {/* CREATE CONTRACT MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Employment Contract</DialogTitle>
            <DialogDescription>
              Establish official wage terms and effective periods for an employee.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateContract} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cnt-emp">Employee</Label>
              <select
                id="cnt-emp"
                required
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnt-num">Contract Number</Label>
              <Input
                id="cnt-num"
                required
                placeholder="e.g. CNT-2026-001"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cnt-start">Start Date</Label>
                <Input
                  id="cnt-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnt-end">End Date (Optional)</Label>
                <Input
                  id="cnt-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="cnt-salary">Base Salary (Per Month)</Label>
                <Input
                  id="cnt-salary"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnt-curr">Currency</Label>
                <Input
                  id="cnt-curr"
                  maxLength={3}
                  required
                  placeholder="USD"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnt-notes">Notes (Optional)</Label>
              <Input
                id="cnt-notes"
                placeholder="Contract provisions or stipulations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Registering..." : "Register Contract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STATUS CHANGE CONFIRMATION */}
      <ConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        title={targetStatus === "ACTIVE" ? "Activate Contract" : "Terminate Contract"}
        description={
          targetStatus === "ACTIVE"
            ? `Activating contract ${targetContract?.contractNumber} will make it the active compensation agreement for payroll calculations.`
            : `Terminating contract ${targetContract?.contractNumber} will end this agreement.`
        }
        variant={targetStatus === "TERMINATED" ? "destructive" : "default"}
        confirmLabel={targetStatus === "ACTIVE" ? "Activate Contract" : "Terminate Contract"}
        onConfirm={handleUpdateStatus}
      />
    </div>
  )
}
