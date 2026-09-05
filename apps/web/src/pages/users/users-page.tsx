import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UserCheckIcon,
  UserXIcon,
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
import type { UserRole } from "@/types/auth"
import type { UserListItem, UserListResponse } from "@/types/user"
import { formatDate, formatDateTime } from "@/utils/format"

const AVAILABLE_ROLES: UserRole[] = [
  "EMPLOYEE",
  "HR_MANAGER",
  "PAYROLL_USER",
  "PAYROLL_MANAGER",
  "ADMIN",
]

export function UsersPage() {
  const { request, user: currentUser } = useAuth()

  const [users, setUsers] = useState<UserListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)

  // Form states
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createRole, setCreateRole] = useState<UserRole>("EMPLOYEE")
  const [isCreating, setIsCreating] = useState(false)

  const [newRole, setNewRole] = useState<UserRole>("EMPLOYEE")
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  // Status toggle confirmation
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [userToToggleStatus, setUserToToggleStatus] = useState<UserListItem | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const response = await request<UserListResponse>(
        `/users?page=${page}&pageSize=${pageSize}`,
      )

      setUsers(response.users)
      setTotalPages(response.pagination.totalPages)
      setTotalCount(response.pagination.total)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, request])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  // Clear toast notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!createEmail || !createPassword) {
      setErrorMessage("Email and password are required")
      return
    }

    try {
      setIsCreating(true)
      await request("/users", {
        method: "POST",
        body: {
          email: createEmail,
          password: createPassword,
          role: createRole,
        },
      })

      setSuccessMessage(`User ${createEmail} created successfully`)
      setCreateDialogOpen(false)
      setCreateEmail("")
      setCreatePassword("")
      setCreateRole("EMPLOYEE")
      void fetchUsers()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdateRole(e: FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setErrorMessage(null)

    try {
      setIsUpdatingRole(true)
      await request(`/users/${selectedUser.id}/role`, {
        method: "PATCH",
        body: { role: newRole },
      })

      setSuccessMessage(`Role updated for ${selectedUser.email}`)
      setRoleDialogOpen(false)
      setSelectedUser(null)
      void fetchUsers()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update role")
    } finally {
      setIsUpdatingRole(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setErrorMessage(null)

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match")
      return
    }

    try {
      setIsResettingPassword(true)
      await request(`/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        body: { newPassword },
      })

      setSuccessMessage(`Password reset successfully for ${selectedUser.email}`)
      setPasswordDialogOpen(false)
      setSelectedUser(null)
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setIsResettingPassword(false)
    }
  }

  async function handleToggleStatus() {
    if (!userToToggleStatus) return

    try {
      await request(`/users/${userToToggleStatus.id}/status`, {
        method: "PATCH",
        body: { isActive: !userToToggleStatus.isActive },
      })

      setSuccessMessage(
        `User ${userToToggleStatus.email} is now ${
          !userToToggleStatus.isActive ? "active" : "deactivated"
        }`,
      )
      void fetchUsers()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to change user status")
    } finally {
      setUserToToggleStatus(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Provision, manage roles, and enforce security policies for administrative accounts.
          </p>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shadow-xs"
        >
          <PlusIcon className="size-4" />
          <span>Create User</span>
        </Button>
      </div>

      {/* Notification Banners */}
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
              <CardTitle className="text-base font-semibold">Registered Users</CardTitle>
              <CardDescription>
                {totalCount} total system account{totalCount === 1 ? "" : "s"}
              </CardDescription>
            </div>

            <div className="relative w-full max-w-xs">
              <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by email..."
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-14 animate-pulse bg-muted/10" />
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48">
                      <EmptyState
                        title="No users found"
                        description={
                          searchTerm
                            ? `No users match the search "${searchTerm}".`
                            : "No user accounts registered yet."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id

                    return (
                      <TableRow key={u.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-medium text-foreground">
                          {u.email}
                          {isSelf && (
                            <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              You
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={u.role} category="general" />
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={u.isActive ? "ACTIVE" : "INACTIVE"}
                            category="employment"
                          />
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(u.lastLoginAt)}
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Change Role Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => {
                                setSelectedUser(u)
                                setNewRole(u.role)
                                setRoleDialogOpen(true)
                              }}
                              title={isSelf ? "You cannot modify your own role" : "Modify User Role"}
                              className="h-8 gap-1 px-2 text-xs"
                            >
                              <ShieldIcon className="size-3.5" />
                              <span>Role</span>
                            </Button>

                            {/* Reset Password Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u)
                                setPasswordDialogOpen(true)
                              }}
                              className="h-8 gap-1 px-2 text-xs"
                            >
                              <KeyRoundIcon className="size-3.5" />
                              <span>Reset</span>
                            </Button>

                            {/* Activate / Deactivate Toggle */}
                            <Button
                              variant={u.isActive ? "ghost" : "outline"}
                              size="sm"
                              disabled={isSelf}
                              onClick={() => {
                                setUserToToggleStatus(u)
                                setStatusConfirmOpen(true)
                              }}
                              className={`h-8 gap-1 px-2 text-xs ${
                                u.isActive
                                  ? "text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                                  : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                              }`}
                              title={isSelf ? "You cannot deactivate your own account" : undefined}
                            >
                              {u.isActive ? (
                                <>
                                  <UserXIcon className="size-3.5" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <UserCheckIcon className="size-3.5" />
                                  <span>Activate</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Bar */}
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

      {/* CREATE USER DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Provision New User</DialogTitle>
            <DialogDescription>
              Create a new authenticated identity with designated RBAC authority.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Work Email</Label>
              <Input
                id="create-email"
                type="email"
                required
                placeholder="colleague@peoplepay360.local"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-password">Initial Password</Label>
              <Input
                id="create-password"
                type="password"
                required
                placeholder="Minimum 8 characters"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role">System Role</Label>
              <select
                id="create-role"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as UserRole)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isCreating} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* UPDATE ROLE DIALOG */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Security Role</DialogTitle>
            <DialogDescription>
              Update RBAC permissions for <span className="font-semibold text-foreground">{selectedUser?.email}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateRole} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Assign Role</Label>
              <select
                id="edit-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isUpdatingRole} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isUpdatingRole}>
                {isUpdatingRole ? "Updating..." : "Save Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Administrative Password Reset</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold text-foreground">{selectedUser?.email}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-new-password">New Password</Label>
              <Input
                id="reset-new-password"
                type="password"
                required
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm-password">Confirm Password</Label>
              <Input
                id="reset-confirm-password"
                type="password"
                required
                placeholder="Re-type new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" type="button" disabled={isResettingPassword} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isResettingPassword}>
                {isResettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STATUS TOGGLE CONFIRMATION */}
      <ConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        title={userToToggleStatus?.isActive ? "Deactivate Account" : "Activate Account"}
        description={
          userToToggleStatus?.isActive
            ? `Deactivating ${userToToggleStatus.email} will immediately invalidate their sessions and prevent them from signing in.`
            : `Activating ${userToToggleStatus?.email} will allow them to authenticate and access the application.`
        }
        variant={userToToggleStatus?.isActive ? "destructive" : "default"}
        confirmLabel={userToToggleStatus?.isActive ? "Deactivate" : "Activate"}
        onConfirm={handleToggleStatus}
      />
    </div>
  )
}
