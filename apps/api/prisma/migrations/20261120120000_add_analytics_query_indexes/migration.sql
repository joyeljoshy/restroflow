-- Part 10 range scans filter by restaurant and the event timestamp that owns
-- each metric. These indexes deliberately avoid changing historical records.
CREATE INDEX "TableSession_restaurantId_closedAt_idx"
  ON "TableSession"("restaurantId", "closedAt");

CREATE INDEX "Order_restaurantId_createdAt_idx"
  ON "Order"("restaurantId", "createdAt");

CREATE INDEX "Bill_restaurantId_finalizedAt_idx"
  ON "Bill"("restaurantId", "finalizedAt");

CREATE INDEX "Payment_restaurantId_recordedAt_idx"
  ON "Payment"("restaurantId", "recordedAt");
