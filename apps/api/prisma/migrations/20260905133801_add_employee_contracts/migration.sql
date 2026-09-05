-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "employee_contracts" (
    "id" UUID NOT NULL,
    "contract_number" VARCHAR(50) NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "base_salary" DECIMAL(65,30) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_contracts_contract_number_key" ON "employee_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "employee_contracts_employee_id_idx" ON "employee_contracts"("employee_id");

-- CreateIndex
CREATE INDEX "employee_contracts_status_idx" ON "employee_contracts"("status");

-- CreateIndex
CREATE INDEX "employee_contracts_start_date_idx" ON "employee_contracts"("start_date");

-- CreateIndex
CREATE INDEX "employee_contracts_end_date_idx" ON "employee_contracts"("end_date");

-- AddForeignKey
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
