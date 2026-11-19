-- Numeric and lifecycle invariants remain database-backed even when writes do
-- not originate from the application service.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "Order_totalMinor_check" CHECK ("totalMinor" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_unitPriceMinor_check" CHECK ("unitPriceMinor" >= 0),
  ADD CONSTRAINT "OrderItem_lineTotalMinor_check" CHECK ("lineTotalMinor" >= 0),
  ADD CONSTRAINT "OrderItem_batchNumber_check" CHECK ("batchNumber" > 0);

ALTER TABLE "OrderItemModifier"
  ADD CONSTRAINT "OrderItemModifier_price_check" CHECK ("modifierPriceMinor" >= 0),
  ADD CONSTRAINT "OrderItemModifier_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "OrderStatusHistory"
  ADD CONSTRAINT "OrderStatusHistory_transition_check" CHECK (
    "previousStatus" IS NULL OR "previousStatus" <> "newStatus"
  );

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "IdempotencyKey_expiration_check" CHECK ("expiresAt" > "createdAt");

CREATE UNIQUE INDEX "OrderItemModifier_orderItemId_modifierId_key"
  ON "OrderItemModifier"("orderItemId", "modifierId")
  WHERE "modifierId" IS NOT NULL;
