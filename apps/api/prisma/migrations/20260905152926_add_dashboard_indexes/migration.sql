-- CreateIndex
CREATE INDEX "employees_joining_date_idx" ON "employees"("joining_date");

-- CreateIndex
CREATE INDEX "employees_created_at_idx" ON "employees"("created_at");

-- CreateIndex
CREATE INDEX "payrun_employees_warning_count_idx" ON "payrun_employees"("warning_count");
