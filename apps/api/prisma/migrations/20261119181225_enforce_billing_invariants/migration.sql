/*
  Warnings:

  - Made the column `billId` on table `PaymentIdempotency` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "PaymentIdempotency" DROP CONSTRAINT "PaymentIdempotency_billId_fkey";

-- AlterTable
ALTER TABLE "PaymentIdempotency" ALTER COLUMN "billId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PaymentIdempotency_restaurantId_billId_idx" ON "PaymentIdempotency"("restaurantId", "billId");

-- AddForeignKey
ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_billId_restaurantId_fkey" FOREIGN KEY ("billId", "restaurantId") REFERENCES "Bill"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial invariants that Prisma cannot represent. Monetary columns use
-- non-negative integer minor units and bill status must agree with its balance.
ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_tax_rate_valid" CHECK ("taxRateBasisPoints" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "Bill_money_nonnegative" CHECK (
    "subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0 AND "amountPaidMinor" >= 0
  ),
  ADD CONSTRAINT "Bill_paid_not_over_total" CHECK ("amountPaidMinor" <= "totalMinor"),
  ADD CONSTRAINT "Bill_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "Bill_status_balance_consistent" CHECK (
    ("status" = 'FINALIZED' AND "totalMinor" > 0 AND "amountPaidMinor" = 0) OR
    ("status" = 'PARTIALLY_PAID' AND "amountPaidMinor" > 0 AND "amountPaidMinor" < "totalMinor") OR
    ("status" = 'PAID' AND "amountPaidMinor" = "totalMinor")
  ),
  ADD CONSTRAINT "Bill_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Bill_finalized_after_creation" CHECK ("finalizedAt" >= "createdAt");

ALTER TABLE "BillItem"
  ADD CONSTRAINT "BillItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "BillItem_batch_positive" CHECK ("batchNumber" > 0),
  ADD CONSTRAINT "BillItem_money_nonnegative" CHECK (
    "unitPriceMinor" >= 0 AND "modifierSubtotalMinor" >= 0 AND
    "lineSubtotalMinor" >= 0 AND "taxAmountMinor" >= 0 AND "finalLineAmountMinor" >= 0
  ),
  ADD CONSTRAINT "BillItem_subtotal_consistent" CHECK (
    "lineSubtotalMinor"::bigint =
      ("unitPriceMinor"::bigint + "modifierSubtotalMinor"::bigint) * "quantity"::bigint
  );

ALTER TABLE "BillItemModifier"
  ADD CONSTRAINT "BillItemModifier_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "BillItemModifier_price_nonnegative" CHECK ("modifierPriceMinor" >= 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "PaymentIdempotency"
  ADD CONSTRAINT "PaymentIdempotency_expiration_valid" CHECK ("expiresAt" > "createdAt");
