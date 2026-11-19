-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('FINALIZED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED');

-- CreateTable
CREATE TABLE "Bill" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableSessionId" UUID NOT NULL,
    "billNumber" VARCHAR(40) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'FINALIZED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" VARCHAR(3) NOT NULL,
    "taxName" VARCHAR(40) NOT NULL,
    "taxRateBasisPoints" INTEGER NOT NULL,
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "roundingPolicy" VARCHAR(40) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "createdByMembershipId" UUID NOT NULL,
    "finalizedByMembershipId" UUID NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "sourceOrderItemId" UUID NOT NULL,
    "orderNumberSnapshot" VARCHAR(32) NOT NULL,
    "itemNameSnapshot" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "modifierSubtotalMinor" INTEGER NOT NULL,
    "lineSubtotalMinor" INTEGER NOT NULL,
    "taxAmountMinor" INTEGER NOT NULL,
    "finalLineAmountMinor" INTEGER NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItemModifier" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "billItemId" UUID NOT NULL,
    "modifierGroupNameSnapshot" VARCHAR(100) NOT NULL,
    "modifierNameSnapshot" VARCHAR(100) NOT NULL,
    "modifierPriceMinor" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "reference" VARCHAR(120),
    "note" VARCHAR(500),
    "recordedByMembershipId" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIdempotency" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "actorMembershipId" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "resultPaymentId" UUID,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "billId" UUID,

    CONSTRAINT "PaymentIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_tableSessionId_key" ON "Bill"("tableSessionId");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_status_finalizedAt_idx" ON "Bill"("restaurantId", "status", "finalizedAt");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_tableSessionId_idx" ON "Bill"("restaurantId", "tableSessionId");

-- CreateIndex
CREATE INDEX "Bill_createdByMembershipId_idx" ON "Bill"("createdByMembershipId");

-- CreateIndex
CREATE INDEX "Bill_finalizedByMembershipId_idx" ON "Bill"("finalizedByMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_restaurantId_billNumber_key" ON "Bill"("restaurantId", "billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_id_restaurantId_key" ON "Bill"("id", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_tableSessionId_restaurantId_key" ON "Bill"("tableSessionId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_sourceOrderItemId_key" ON "BillItem"("sourceOrderItemId");

-- CreateIndex
CREATE INDEX "BillItem_restaurantId_billId_idx" ON "BillItem"("restaurantId", "billId");

-- CreateIndex
CREATE INDEX "BillItem_sourceOrderItemId_idx" ON "BillItem"("sourceOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_id_restaurantId_key" ON "BillItem"("id", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_sourceOrderItemId_restaurantId_key" ON "BillItem"("sourceOrderItemId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_billId_sourceOrderItemId_key" ON "BillItem"("billId", "sourceOrderItemId");

-- CreateIndex
CREATE INDEX "BillItemModifier_restaurantId_billItemId_idx" ON "BillItemModifier"("restaurantId", "billItemId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_billId_recordedAt_idx" ON "Payment"("restaurantId", "billId", "recordedAt");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_method_recordedAt_idx" ON "Payment"("restaurantId", "method", "recordedAt");

-- CreateIndex
CREATE INDEX "Payment_recordedByMembershipId_idx" ON "Payment"("recordedByMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_restaurantId_key" ON "Payment"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "PaymentIdempotency_expiresAt_idx" ON "PaymentIdempotency"("expiresAt");

-- CreateIndex
CREATE INDEX "PaymentIdempotency_resultPaymentId_idx" ON "PaymentIdempotency"("resultPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIdempotency_restaurantId_actorMembershipId_key_key" ON "PaymentIdempotency"("restaurantId", "actorMembershipId", "key");

-- RenameForeignKey
ALTER TABLE "OrderItemStatusHistory" RENAME CONSTRAINT "OrderItemStatusHistory_orderItemId_fkey" TO "OrderItemStatusHistory_orderItemId_restaurantId_fkey";

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tableSessionId_restaurantId_fkey" FOREIGN KEY ("tableSessionId", "restaurantId") REFERENCES "TableSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdByMembershipId_restaurantId_fkey" FOREIGN KEY ("createdByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_finalizedByMembershipId_restaurantId_fkey" FOREIGN KEY ("finalizedByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_restaurantId_fkey" FOREIGN KEY ("billId", "restaurantId") REFERENCES "Bill"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_sourceOrderItemId_restaurantId_fkey" FOREIGN KEY ("sourceOrderItemId", "restaurantId") REFERENCES "OrderItem"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemModifier" ADD CONSTRAINT "BillItemModifier_billItemId_restaurantId_fkey" FOREIGN KEY ("billItemId", "restaurantId") REFERENCES "BillItem"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_restaurantId_fkey" FOREIGN KEY ("billId", "restaurantId") REFERENCES "Bill"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByMembershipId_restaurantId_fkey" FOREIGN KEY ("recordedByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_actorMembershipId_restaurantId_fkey" FOREIGN KEY ("actorMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_resultPaymentId_restaurantId_fkey" FOREIGN KEY ("resultPaymentId", "restaurantId") REFERENCES "Payment"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "TableOrderingActivation_restaurantId_tableSessionId_expiresAt_i" RENAME TO "TableOrderingActivation_restaurantId_tableSessionId_expires_idx";
