import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircleIcon,
  BadgePercentIcon,
  CheckCircle2Icon,
  EyeIcon,
  PlusIcon,
  SearchIcon,
  UserPlusIcon,
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
import type { Employee, EmployeeListResponse } from "@/types/hr"
import { canManagePayroll } from "@/utils/roles"

interface SalaryRuleItem {
  id: string
  code: string
  name: string
  category: string
  sequence: number
}

interface SalaryStructureItem {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  rules: SalaryRuleItem[]
  createdAt: string
}

interface SalaryStructuresResponse {
  salaryStructures: SalaryStructureItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function SalaryStructuresPage() {
  const { request, user } = useAuth()
  const canManage = canManagePayroll(user?.role)

  const [structures, setStructures] = useState<SalaryStructureItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create Structure Dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Assign Structure Dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignEmployeeId, setAssignEmployeeId] = useState("")
  const [assignStructureId, setAssignStructureId] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState("")
  const [closePrevious, setClosePrevious] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const fetchStructures = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const res = await request<SalaryStructuresResponse>("/salary-structures?page=1&pageSize=50")
      setStructures(res.salaryStructures)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load salary structures")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await request<EmployeeListResponse>("/employees?page=1&pageSize=100")
      setEmployees(res.employees)
    } catch (err) {
      console.error("Failed to load employees", err)
    }
  }, [request])

  useEffect(() => {
    void fetchStructures()
    if (canManage) {
      void fetchEmployees()
    }
  }, [canManage, fetchEmployees, fetchStructures])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateModal() {
    setCode(`SAL-${Date.now().toString().slice(-4)}`)
    setName("")
    setDescription("")
    setCreateError(null)
    setCreateOpen(true)
  }

  function openAssignModal(structId?: string) {
    setAssignEmployeeId(employees[0]?.id || "")
    setAssignStructureId(structId || structures[0]?.id || "")
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
    setEffectiveTo("")
    setClosePrevious(true)
    setAssignError(null)
    setAssignOpen(true)
  }

  async function handleCreateStructure(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setErrorMessage(null)

    try {
      setIsCreating(true)
      await request("/salary-structures", {
        method: "POST",
        body: {
          code: code.trim().toUpperCase(),
          name,
          description: description || null,
          isActive: true,
        },
      })

      setSuccessMessage(`Salary structure "${name}" (${code}) created successfully`)
      setCreateOpen(false)
      void fetchStructures()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create salary structure"
      setCreateError(msg)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleAssignStructure(e: FormEvent) {
    e.preventDefault()
    setAssignError(null)
    setErrorMessage(null)

    if (!assignEmployeeId || !assignStructureId) {
      setAssignError("Employee and structure selection are required")
      return
    }

    try {
      setIsAssigning(true)
      await request(`/employees/${assignEmployeeId}/salary-structures`, {
        method: "POST",
        body: {
          structureId: assignStructureId,
          effectiveFrom,
          effectiveTo: effectiveTo ? effectiveTo : null,
          closePrevious,
        },
      })

      setSuccessMessage("Salary structure assigned to employee successfully")
      setAssignOpen(false)
      void fetchStructures()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to assign salary structure"
      setAssignError(msg)
    } finally {
      setIsAssigning(false)
    }
  }

  const filteredStructures = structures.filter((s) => {
    const q = searchTerm.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Salary Structures</h1>
          <p className="text-sm text-muted-foreground">
            Declarative compensation profiles, earning formulas, statutory deduction rules, and employee assignments.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openAssignModal()} className="gap-2 shadow-xs">
              <UserPlusIcon className="size-4" />
              <span>Assign Structure</span>
            </Button>
            <Button onClick={openCreateModal} className="gap-2 shadow-xs">
              <PlusIcon className="size-4" />
              <span>Create Structure</span>
            </Button>
          </div>
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
              <CardTitle className="text-base font-semibold">Configured Salary Structures</CardTitle>
              <CardDescription>
                {structures.length} salary template profile{structures.length === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-60">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search structures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Structure Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Rules Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredStructures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48">
                      <EmptyState
                        title="No salary structures found"
                        description="Define salary structures with earning and deduction rules to calculate payroll."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStructures.map((s) => (
                    <TableRow key={s.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {s.code}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">{s.name}</TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {s.description || "—"}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <BadgePercentIcon className="size-3" />
                          {s.rules?.length ?? 0} rules
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={s.isActive ? "ACTIVE" : "INACTIVE"}
                          category="general"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link to={`/salary-structures/${s.id}`} />}
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            <EyeIcon className="size-3.5" />
                            <span>Rules</span>
                          </Button>

                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignModal(s.id)}
                              className="h-8 gap-1 px-2 text-xs"
                            >
                              <UserPlusIcon className="size-3.5" />
                              <span>Assign</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE SALARY STRUCTURE MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Define Salary Structure</DialogTitle>
            <DialogDescription>
              Create a reusable compensation template. Rules can be added after creation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStructure} className="space-y-4 py-2">
            {createError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
                <AlertCircleIcon className="size-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sal-code">Structure Code</Label>
              <Input
                id="sal-code"
                required
                placeholder="e.g. STANDARD-SALARY, EXEC-COMP"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sal-name">Structure Name</Label>
              <Input
                id="sal-name"
                required
                placeholder="e.g. Standard Full-Time Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sal-desc">Description (Optional)</Label>
              <Input
                id="sal-desc"
                placeholder="Applicable employee tiers or benefits..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Structure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ASSIGN SALARY STRUCTURE MODAL */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salary Structure</DialogTitle>
            <DialogDescription>
              Bind compensation rules to an employee for active payroll cycles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssignStructure} className="space-y-4 py-2">
            {assignError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
                <AlertCircleIcon className="size-4 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="as-emp">Employee</Label>
              <select
                id="as-emp"
                required
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
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
              <Label htmlFor="as-struct">Salary Structure</Label>
              <select
                id="as-struct"
                required
                value={assignStructureId}
                onChange={(e) => setAssignStructureId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>Select Structure</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-from">Effective From</Label>
                <Input
                  id="as-from"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="as-to">Effective To (Optional)</Label>
                <Input
                  id="as-to"
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="as-close-prev"
                checked={closePrevious}
                onChange={(e) => setClosePrevious(e.target.checked)}
                className="size-4 rounded-sm border border-input text-primary accent-primary cursor-pointer"
              />
              <Label htmlFor="as-close-prev" className="cursor-pointer text-xs font-normal text-muted-foreground">
                Automatically close / supersede previous active assignment
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isAssigning} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isAssigning}>
                {isAssigning ? "Assigning..." : "Save Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
