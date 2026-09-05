-- CreateEnum
CREATE TYPE "PayrunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'VALIDATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payruns" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "PayrunStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "calculated_at" TIMESTAMPTZ(3),
    "validated_at" TIMESTAMPTZ(3),
    "validated_by_user_id" UUID,
    "total_gross" DECIMAL(14,2),
    "total_deductions" DECIMAL(14,2),
    "total_net" DECIMAL(14,2),
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payruns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_employees" (
    "id" UUID NOT NULL,
    "payrun_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_id" UUID,
    "contract_snapshot" JSONB,
    "salary_structure_id" UUID,
    "salary_structure_snapshot" JSONB,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "deduction_amount" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "line_items" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payrun_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payruns_code_key" ON "payruns"("code");

-- CreateIndex
CREATE INDEX "payruns_period_start_idx" ON "payruns"("period_start");

-- CreateIndex
CREATE INDEX "payruns_period_end_idx" ON "payruns"("period_end");

-- CreateIndex
CREATE INDEX "payruns_status_idx" ON "payruns"("status");

-- CreateIndex
CREATE INDEX "payrun_employees_payrun_id_idx" ON "payrun_employees"("payrun_id");

-- CreateIndex
CREATE INDEX "payrun_employees_employee_id_idx" ON "payrun_employees"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_employees_payrun_id_employee_id_key" ON "payrun_employees"("payrun_id", "employee_id");

-- AddForeignKey
ALTER TABLE "payruns" ADD CONSTRAINT "payruns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payruns" ADD CONSTRAINT "payruns_validated_by_user_id_fkey" FOREIGN KEY ("validated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_employees" ADD CONSTRAINT "payrun_employees_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_employees" ADD CONSTRAINT "payrun_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
