import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Edit2Icon,
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
import type { Department } from "@/types/hr"
import { isHr } from "@/utils/roles"

interface DepartmentResponse {
  departments: Department[]
}

export function DepartmentsPage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [departments, setDepartments] = useState<Department[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  // Form state
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const data = await request<DepartmentResponse>("/departments")
      setDepartments(data.departments)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load departments")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void fetchDepartments()
  }, [fetchDepartments])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateDialog() {
    setEditingDepartment(null)
    setCode("")
    setName("")
    setDescription("")
    setIsActive(true)
    setDialogOpen(true)
  }

  function openEditDialog(dept: Department) {
    setEditingDepartment(dept)
    setCode(dept.code)
    setName(dept.name)
    setDescription(dept.description || "")
    setIsActive(dept.isActive)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    try {
      setIsSubmitting(true)

      if (editingDepartment) {
        // Edit Department
        await request(`/departments/${editingDepartment.id}`, {
          method: "PATCH",
          body: {
            name,
            description: description || null,
            isActive,
          },
        })
        setSuccessMessage(`Department "${name}" updated successfully`)
      } else {
        // Create Department
        await request("/departments", {
          method: "POST",
          body: {
            code,
            name,
            description: description || null,
            isActive,
          },
        })
        setSuccessMessage(`Department "${name}" created successfully`)
      }

      setDialogOpen(false)
      void fetchDepartments()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save department")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredDepartments = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground">
            Organizational hierarchy and departmental division management.
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreateDialog} className="gap-2 shadow-xs">
            <PlusIcon className="size-4" />
            <span>Add Department</span>
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

      {/* Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Department Directory</CardTitle>
              <CardDescription>
                {departments.length} registered department{departments.length === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="relative w-full max-w-xs">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search departments..."
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
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={canManage ? 5 : 4} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-48">
                      <EmptyState
                        title="No departments found"
                        description={
                          searchTerm
                            ? `No departments match "${searchTerm}".`
                            : "No departments created yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((dept) => (
                    <TableRow key={dept.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {dept.code}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{dept.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dept.description || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={dept.isActive ? "ACTIVE" : "INACTIVE"}
                          category="general"
                        />
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(dept)}
                            className="h-8 gap-1.5 px-2 text-xs"
                          >
                            <Edit2Icon className="size-3.5" />
                            <span>Edit</span>
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

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? `Update details for department "${editingDepartment.name}".`
                : "Enter code and organizational details to create a new department."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Department Code</Label>
              <Input
                id="dept-code"
                required
                disabled={Boolean(editingDepartment)}
                placeholder="e.g. ENG, FIN, HR"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input
                id="dept-name"
                required
                placeholder="e.g. Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Description (Optional)</Label>
              <Input
                id="dept-desc"
                placeholder="Brief description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {editingDepartment && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="dept-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4 rounded-sm border border-input text-primary focus:ring-primary"
                />
                <Label htmlFor="dept-active" className="cursor-pointer text-sm font-normal">
                  Department is Active
                </Label>
              </div>
            )}

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isSubmitting} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingDepartment
                  ? "Save Changes"
                  : "Create Department"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}