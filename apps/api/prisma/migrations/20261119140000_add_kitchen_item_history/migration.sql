-- Part 7 adds an append-only audit trail for item preparation changes.
CREATE TABLE "OrderItemStatusHistory" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "previousStatus" "OrderItemStatus",
    "newStatus" "OrderItemStatus" NOT NULL,
    "actorMembershipId" UUID NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItemStatusHistory_orderItemId_createdAt_idx"
    ON "OrderItemStatusHistory"("orderItemId", "createdAt");
CREATE INDEX "OrderItemStatusHistory_restaurantId_newStatus_createdAt_idx"
    ON "OrderItemStatusHistory"("restaurantId", "newStatus", "createdAt");
CREATE INDEX "OrderItemStatusHistory_actorMembershipId_createdAt_idx"
    ON "OrderItemStatusHistory"("actorMembershipId", "createdAt");
CREATE UNIQUE INDEX "OrderItem_id_restaurantId_key"
    ON "OrderItem"("id", "restaurantId");

ALTER TABLE "OrderItemStatusHistory"
    ADD CONSTRAINT "OrderItemStatusHistory_orderItemId_fkey"
    FOREIGN KEY ("orderItemId", "restaurantId")
    REFERENCES "OrderItem"("id", "restaurantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItemStatusHistory"
    ADD CONSTRAINT "OrderItemStatusHistory_actorMembershipId_restaurantId_fkey"
    FOREIGN KEY ("actorMembershipId", "restaurantId")
    REFERENCES "StaffMembership"("id", "restaurantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
