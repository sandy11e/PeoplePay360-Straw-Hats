-- CreateEnum
CREATE TYPE "SalaryRuleCategory" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "SalaryRuleCalculationType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "SalaryRuleBase" AS ENUM ('BASE_SALARY', 'GROSS_EARNINGS');

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_rules" (
    "id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "SalaryRuleCategory" NOT NULL,
    "calculation_type" "SalaryRuleCalculationType" NOT NULL,
    "amount" DECIMAL(12,2),
    "percentage" DECIMAL(5,2),
    "base" "SalaryRuleBase",
    "sequence" INTEGER NOT NULL,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_structure_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_salary_structure_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_code_key" ON "salary_structures"("code");

-- CreateIndex
CREATE INDEX "salary_rules_structure_id_idx" ON "salary_rules"("structure_id");

-- CreateIndex
CREATE INDEX "salary_rules_category_idx" ON "salary_rules"("category");

-- CreateIndex
CREATE INDEX "salary_rules_sequence_idx" ON "salary_rules"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "salary_rules_structure_id_code_key" ON "salary_rules"("structure_id", "code");

-- CreateIndex
CREATE INDEX "employee_salary_structure_assignments_employee_id_idx" ON "employee_salary_structure_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_salary_structure_assignments_structure_id_idx" ON "employee_salary_structure_assignments"("structure_id");

-- CreateIndex
CREATE INDEX "employee_salary_structure_assignments_effective_from_idx" ON "employee_salary_structure_assignments"("effective_from");

-- CreateIndex
CREATE INDEX "employee_salary_structure_assignments_effective_to_idx" ON "employee_salary_structure_assignments"("effective_to");

-- AddForeignKey
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_structure_assignments" ADD CONSTRAINT "employee_salary_structure_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_structure_assignments" ADD CONSTRAINT "employee_salary_structure_assignments_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
