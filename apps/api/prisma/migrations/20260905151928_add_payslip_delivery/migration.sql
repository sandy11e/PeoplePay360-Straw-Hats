-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "payslip_deliveries" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "recipient" VARCHAR(320) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(3),
    "error_message" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payslip_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payslip_deliveries_payslip_id_idx" ON "payslip_deliveries"("payslip_id");

-- CreateIndex
CREATE INDEX "payslip_deliveries_status_idx" ON "payslip_deliveries"("status");

-- CreateIndex
CREATE INDEX "payslip_deliveries_channel_idx" ON "payslip_deliveries"("channel");

-- AddForeignKey
ALTER TABLE "payslip_deliveries" ADD CONSTRAINT "payslip_deliveries_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
