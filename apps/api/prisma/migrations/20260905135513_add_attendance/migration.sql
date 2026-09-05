-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'KIOSK', 'MANUAL');

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "check_in_at" TIMESTAMPTZ(3) NOT NULL,
    "check_out_at" TIMESTAMPTZ(3),
    "worked_minutes" INTEGER,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "source" "AttendanceSource" NOT NULL DEFAULT 'WEB',
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendances_employee_id_idx" ON "attendances"("employee_id");

-- CreateIndex
CREATE INDEX "attendances_attendance_date_idx" ON "attendances"("attendance_date");

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status");

-- CreateIndex
CREATE INDEX "attendances_check_in_at_idx" ON "attendances"("check_in_at");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreatePartialUniqueIndex: an employee cannot have multiple open attendance sessions
CREATE UNIQUE INDEX "unique_open_attendance_per_employee" ON "attendances"("employee_id") WHERE "check_out_at" IS NULL;
