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
import type { JobPosition } from "@/types/hr"
import { isHr } from "@/utils/roles"

interface JobPositionResponse {
  jobPositions: JobPosition[]
}

export function JobPositionsPage() {
  const { request, user } = useAuth()
  const canManage = isHr(user?.role)

  const [positions, setPositions] = useState<JobPosition[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null)

  // Form state
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchPositions = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const data = await request<JobPositionResponse>("/job-positions")
      setPositions(data.jobPositions)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load job positions")
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    void fetchPositions()
  }, [fetchPositions])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  function openCreateDialog() {
    setEditingPosition(null)
    setCode("")
    setTitle("")
    setDescription("")
    setIsActive(true)
    setDialogOpen(true)
  }

  function openEditDialog(pos: JobPosition) {
    setEditingPosition(pos)
    setCode(pos.code)
    setTitle(pos.title)
    setDescription(pos.description || "")
    setIsActive(pos.isActive)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    try {
      setIsSubmitting(true)

      if (editingPosition) {
        // Edit Job Position
        await request(`/job-positions/${editingPosition.id}`, {
          method: "PATCH",
          body: {
            title,
            description: description || null,
            isActive,
          },
        })
        setSuccessMessage(`Job position "${title}" updated successfully`)
      } else {
        // Create Job Position
        await request("/job-positions", {
          method: "POST",
          body: {
            code,
            title,
            description: description || null,
            isActive,
          },
        })
        setSuccessMessage(`Job position "${title}" created successfully`)
      }

      setDialogOpen(false)
      void fetchPositions()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save job position")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPositions = positions.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Job Positions</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizational roles, designations, and job titles.
          </p>
        </div>

        {canManage && (
          <Button onClick={openCreateDialog} className="gap-2 shadow-xs">
            <PlusIcon className="size-4" />
            <span>Add Job Position</span>
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
              <CardTitle className="text-base font-semibold">Designations Directory</CardTitle>
              <CardDescription>
                {positions.length} configured job position{positions.length === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="relative w-full max-w-xs">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search positions..."
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
                  <TableHead>Job Title</TableHead>
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
                ) : filteredPositions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 5 : 4} className="h-48">
                      <EmptyState
                        title="No job positions found"
                        description={
                          searchTerm
                            ? `No positions match "${searchTerm}".`
                            : "No job positions created yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPositions.map((pos) => (
                    <TableRow key={pos.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {pos.code}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{pos.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pos.description || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={pos.isActive ? "ACTIVE" : "INACTIVE"}
                          category="general"
                        />
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(pos)}
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
            <DialogTitle>{editingPosition ? "Edit Job Position" : "Add Job Position"}</DialogTitle>
            <DialogDescription>
              {editingPosition
                ? `Update details for position "${editingPosition.title}".`
                : "Create a new role title for employee organizational classification."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-code">Position Code</Label>
              <Input
                id="pos-code"
                required
                disabled={Boolean(editingPosition)}
                placeholder="e.g. SWE, PM, HR_SPEC"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-title">Position Title</Label>
              <Input
                id="pos-title"
                required
                placeholder="e.g. Senior Software Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-desc">Description (Optional)</Label>
              <Input
                id="pos-desc"
                placeholder="Responsibilities summary..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {editingPosition && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pos-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4 rounded-sm border border-input text-primary focus:ring-primary"
                />
                <Label htmlFor="pos-active" className="cursor-pointer text-sm font-normal">
                  Job Position is Active
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
                  : editingPosition
                  ? "Save Changes"
                  : "Create Position"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}