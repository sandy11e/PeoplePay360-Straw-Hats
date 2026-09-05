import { useState, useRef, type DragEvent, type ChangeEvent } from "react"
import * as XLSX from "xlsx"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  RefreshCwIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
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

export interface ParsedEmployeeRow {
  rowNumber: number
  employeeCode: string
  firstName: string
  middleName?: string
  lastName: string
  workEmail: string
  phone?: string
  joiningDate: string
  department: string
  jobPosition: string
  manager?: string
  baseSalary?: number
  currency?: string
  salaryStructure?: string
  employmentStatus?: string
  isValid: boolean
  errors: string[]
}

import type { ApiOptions } from "@/api/api"

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
  request: <T>(path: string, options?: ApiOptions) => Promise<T>
}

interface BulkImportApiResponse {
  totalProcessed: number
  importedCount: number
  failedCount: number
  imported: unknown[]
  errors: Array<{
    rowNumber: number
    employeeCode?: string
    workEmail?: string
    reason: string
  }>
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
  request,
}: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Options
  const [autoCreateContract, setAutoCreateContract] = useState(true)
  const [assignDefaultSchedule, setAssignDefaultSchedule] = useState(true)
  const [allocateDefaultLeaves, setAllocateDefaultLeaves] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    setFile(null)
    setParsedRows([])
    setErrorMessage(null)
    setIsParsing(false)
    setIsSubmitting(false)
  }

  function handleDialogClose(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  function formatExcelDate(raw: unknown): string {
    if (!raw) return ""
    if (typeof raw === "number") {
      // Excel serial date number
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000))
      return !isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : ""
    }
    if (raw instanceof Date) {
      return !isNaN(raw.getTime()) ? raw.toISOString().slice(0, 10) : ""
    }
    const str = String(raw).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str
    }
    // Try parse common date string (e.g. DD/MM/YYYY or MM/DD/YYYY)
    const parsed = new Date(str)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
    return str
  }

  async function parseFile(selectedFile: File) {
    setIsParsing(true)
    setErrorMessage(null)
    setFile(selectedFile)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", cellDates: true })

      const sheetName = wb.SheetNames[0]
      if (!sheetName) {
        throw new Error("No worksheets found in the uploaded file")
      }

      const sheet = wb.Sheets[sheetName]
      if (!sheet) {
        throw new Error("Worksheet content is empty")
      }

      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
      })

      if (rows.length < 2) {
        throw new Error("The Excel sheet must have a header row and at least one data row")
      }

      // Find header row
      const headerRow = (rows[0] ?? []).map((h) =>
        String(h ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ""),
      )

      // Index column positions
      const getColIdx = (...terms: string[]) => {
        return headerRow.findIndex((col) =>
          terms.some((t) => col.includes(t.replace(/[^a-z0-9]/g, ""))),
        )
      }

      const codeIdx = getColIdx("employeecode", "code", "empid")
      const firstIdx = getColIdx("firstname", "first")
      const middleIdx = getColIdx("middlename", "middle")
      const lastIdx = getColIdx("lastname", "last", "surname")
      const emailIdx = getColIdx("workemail", "email", "mail")
      const phoneIdx = getColIdx("phone", "contact", "mobile")
      const dateIdx = getColIdx("joiningdate", "joindate", "startdate", "joining")
      const deptIdx = getColIdx("department", "dept")
      const posIdx = getColIdx("jobposition", "position", "designation", "role", "title")
      const salaryIdx = getColIdx("basesalary", "salary", "basepay")
      const currIdx = getColIdx("currency")
      const structureIdx = getColIdx("salarystructure", "structure")
      const statusIdx = getColIdx("employmentstatus", "status")

      if (codeIdx === -1 || firstIdx === -1 || lastIdx === -1 || emailIdx === -1) {
        throw new Error(
          "Missing required columns in header. Please ensure 'Employee Code', 'First Name', 'Last Name', and 'Work Email' columns are present.",
        )
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const results: ParsedEmployeeRow[] = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === "")) {
          continue
        }

        const employeeCode = String(row[codeIdx] ?? "").trim().toUpperCase()
        const firstName = String(row[firstIdx] ?? "").trim()
        const middleName = middleIdx !== -1 ? String(row[middleIdx] ?? "").trim() : undefined
        const lastName = String(row[lastIdx] ?? "").trim()
        const workEmail = String(row[emailIdx] ?? "").trim().toLowerCase()
        const phone = phoneIdx !== -1 ? String(row[phoneIdx] ?? "").trim() : undefined
        const rawDate = dateIdx !== -1 ? row[dateIdx] : ""
        const joiningDate = formatExcelDate(rawDate) || new Date().toISOString().slice(0, 10)
        const department = deptIdx !== -1 ? String(row[deptIdx] ?? "").trim() : "General"
        const jobPosition = posIdx !== -1 ? String(row[posIdx] ?? "").trim() : "Team Member"
        const rawSalary = salaryIdx !== -1 ? row[salaryIdx] : undefined
        const baseSalary = rawSalary !== undefined && rawSalary !== null && rawSalary !== "" && !isNaN(Number(rawSalary))
          ? Number(rawSalary)
          : undefined
        const currency = currIdx !== -1 && row[currIdx] ? String(row[currIdx]).trim().toUpperCase().slice(0, 3) : "USD"
        const salaryStructure = structureIdx !== -1 && row[structureIdx] ? String(row[structureIdx]).trim() : undefined
        const employmentStatus = statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim().toUpperCase() : "ACTIVE"

        const errors: string[] = []
        if (!employeeCode || employeeCode.length < 2) {
          errors.push("Employee code is required (min 2 chars)")
        }
        if (!firstName) {
          errors.push("First name is required")
        }
        if (!lastName) {
          errors.push("Last name is required")
        }
        if (!workEmail || !emailRegex.test(workEmail)) {
          errors.push("Valid work email is required")
        }
        if (!joiningDate || !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) {
          errors.push("Joining date must be in YYYY-MM-DD format")
        }
        if (!department) {
          errors.push("Department is required")
        }
        if (!jobPosition) {
          errors.push("Job position is required")
        }

        results.push({
          rowNumber: i + 1,
          employeeCode,
          firstName,
          middleName: middleName || undefined,
          lastName,
          workEmail,
          phone: phone || undefined,
          joiningDate,
          department,
          jobPosition,
          baseSalary,
          currency,
          salaryStructure,
          employmentStatus,
          isValid: errors.length === 0,
          errors,
        })
      }

      if (results.length === 0) {
        throw new Error("No data rows found in the sheet")
      }

      setParsedRows(results)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to parse the uploaded file")
      setParsedRows([])
    } finally {
      setIsParsing(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files[0]) {
      void parseFile(files[0])
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files[0]) {
      void parseFile(files[0])
    }
  }

  const validRows = parsedRows.filter((r) => r.isValid)
  const errorRows = parsedRows.filter((r) => !r.isValid)

  async function handleImport() {
    if (validRows.length === 0) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const payload = {
        employees: validRows.map((r) => ({
          employeeCode: r.employeeCode,
          firstName: r.firstName,
          middleName: r.middleName || null,
          lastName: r.lastName,
          workEmail: r.workEmail,
          phone: r.phone || null,
          joiningDate: r.joiningDate,
          department: r.department,
          jobPosition: r.jobPosition,
          employmentStatus: r.employmentStatus || "ACTIVE",
          baseSalary: r.baseSalary || null,
          currency: r.currency || "USD",
          salaryStructure: r.salaryStructure || null,
        })),
        autoCreateContract,
        assignDefaultSchedule,
        allocateDefaultLeaves,
      }

      const response = await request<BulkImportApiResponse>("/employees/bulk-import", {
        method: "POST",
        body: payload,
      })

      if (response.failedCount > 0 && response.importedCount === 0) {
        const reasons = response.errors.map((e) => `Row ${e.rowNumber}: ${e.reason}`).join("; ")
        throw new Error(`Import failed for all rows: ${reasons}`)
      }

      let msg = `Successfully imported ${response.importedCount} employee${response.importedCount === 1 ? "" : "s"}.`
      if (response.failedCount > 0) {
        msg += ` (${response.failedCount} row${response.failedCount === 1 ? "" : "s"} skipped due to conflicts)`
      }

      onSuccess(msg)
      handleDialogClose(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to import employees")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-xs">
              <FileSpreadsheetIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Import Employees via Excel
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload an Excel spreadsheet (.xlsx, .xls) or CSV to add multiple employees in bulk.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="my-2 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
            <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Dropzone Area */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <UploadCloudIcon className="size-7" />
              </div>

              <h3 className="text-sm font-semibold text-foreground">
                Drop your Excel spreadsheet here, or{" "}
                <span className="text-primary underline">browse</span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports Microsoft Excel (.xlsx, .xls) and standard CSV files up to 500 rows.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Card */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <FileSpreadsheetIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} employee record
                      {parsedRows.length === 1 ? "" : "s"} detected
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2Icon className="size-3" />
                      {validRows.length} Valid
                    </span>
                    {errorRows.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                        <AlertTriangleIcon className="size-3" />
                        {errorRows.length} Issues
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={resetState}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs">
                <div className="bg-muted/40 px-3 py-2 border-b border-border/60 text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Excel Sheet Data Preview</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Showing all parsed rows
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/20 sticky top-0 z-10">
                      <TableRow className="text-[11px]">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead className="w-24">Joining</TableHead>
                        <TableHead className="w-20">Salary</TableHead>
                        <TableHead className="w-24 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {parsedRows.map((row) => (
                        <TableRow
                          key={row.rowNumber}
                          className={`text-xs ${
                            !row.isValid ? "bg-destructive/5 hover:bg-destructive/10" : ""
                          }`}
                        >
                          <TableCell className="font-mono text-muted-foreground">
                            {row.rowNumber}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {row.employeeCode || "—"}
                          </TableCell>
                          <TableCell>
                            {row.firstName} {row.middleName ? `${row.middleName} ` : ""}
                            {row.lastName}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-[11px]">
                            {row.workEmail || "—"}
                          </TableCell>
                          <TableCell>{row.department}</TableCell>
                          <TableCell>{row.jobPosition}</TableCell>
                          <TableCell className="font-mono text-[11px]">
                            {row.joiningDate}
                          </TableCell>
                          <TableCell className="font-mono text-[11px]">
                            {row.baseSalary ? `${row.currency} ${row.baseSalary}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2Icon className="size-2.5" />
                                Ready
                              </span>
                            ) : (
                              <span
                                title={row.errors.join(", ")}
                                className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive cursor-help"
                              >
                                <AlertTriangleIcon className="size-2.5" />
                                {row.errors[0]}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Automatic Configuration Options */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Automated Onboarding Options</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={autoCreateContract}
                      onChange={(e) => setAutoCreateContract(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary size-4"
                    />
                    <span>Create active contract if Base Salary is set</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={assignDefaultSchedule}
                      onChange={(e) => setAssignDefaultSchedule(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary size-4"
                    />
                    <span>Assign default work schedule for attendance</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={allocateDefaultLeaves}
                      onChange={(e) => setAllocateDefaultLeaves(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary size-4"
                    />
                    <span>Allocate default annual leaves (current year)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDialogClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={isSubmitting || isParsing || validRows.length === 0}
            className="gap-2 font-semibold shadow-xs cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCwIcon className="size-3.5 animate-spin" />
                <span>Importing Employees...</span>
              </>
            ) : (
              <>
                <FileSpreadsheetIcon className="size-3.5" />
                <span>
                  Import {validRows.length > 0 ? `${validRows.length} Employees` : "Employees"}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
