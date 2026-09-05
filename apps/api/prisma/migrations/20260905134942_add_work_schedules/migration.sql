-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_days" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "expected_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedule_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_code_key" ON "work_schedules"("code");

-- CreateIndex
CREATE INDEX "work_schedule_days_schedule_id_idx" ON "work_schedule_days"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_days_schedule_id_day_of_week_key" ON "work_schedule_days"("schedule_id", "day_of_week");

-- CreateIndex
CREATE INDEX "employee_schedule_assignments_employee_id_idx" ON "employee_schedule_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_schedule_assignments_schedule_id_idx" ON "employee_schedule_assignments"("schedule_id");

-- CreateIndex
CREATE INDEX "employee_schedule_assignments_effective_from_idx" ON "employee_schedule_assignments"("effective_from");

-- CreateIndex
CREATE INDEX "employee_schedule_assignments_effective_to_idx" ON "employee_schedule_assignments"("effective_to");

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule_assignments" ADD CONSTRAINT "employee_schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
