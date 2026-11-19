-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WAITER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdempotencyOperation" AS ENUM ('CREATE_ORDER', 'ADD_ORDER_ITEMS');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableSessionId" UUID NOT NULL,
    "orderNumber" VARCHAR(32) NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'WAITER',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalMinor" INTEGER NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "itemNameSnapshot" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "specialInstructions" VARCHAR(500),
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "batchNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "modifierGroupId" UUID,
    "modifierId" UUID,
    "modifierGroupNameSnapshot" VARCHAR(100) NOT NULL,
    "modifierNameSnapshot" VARCHAR(100) NOT NULL,
    "modifierPriceMinor" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "previousStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "actorMembershipId" UUID NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "actorMembershipId" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "operation" "IdempotencyOperation" NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "resultOrderId" UUID,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_tableSessionId_createdAt_idx" ON "Order"("tableSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdByMembershipId_createdAt_idx" ON "Order"("createdByMembershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_orderNumber_key" ON "Order"("restaurantId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_restaurantId_key" ON "Order"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_batchNumber_createdAt_idx" ON "OrderItem"("orderId", "batchNumber", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_restaurantId_status_createdAt_idx" ON "OrderItem"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_id_orderId_key" ON "OrderItem"("id", "orderId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_modifierId_idx" ON "OrderItemModifier"("modifierId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_restaurantId_newStatus_createdAt_idx" ON "OrderStatusHistory"("restaurantId", "newStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_actorMembershipId_createdAt_idx" ON "OrderStatusHistory"("actorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_resultOrderId_idx" ON "IdempotencyKey"("resultOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_restaurantId_actorMembershipId_key_key" ON "IdempotencyKey"("restaurantId", "actorMembershipId", "key");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_restaurantId_fkey" FOREIGN KEY ("tableSessionId", "restaurantId") REFERENCES "TableSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByMembershipId_restaurantId_fkey" FOREIGN KEY ("createdByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_restaurantId_fkey" FOREIGN KEY ("orderId", "restaurantId") REFERENCES "Order"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_restaurantId_fkey" FOREIGN KEY ("menuItemId", "restaurantId") REFERENCES "MenuItem"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "Modifier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_restaurantId_fkey" FOREIGN KEY ("orderId", "restaurantId") REFERENCES "Order"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorMembershipId_restaurantId_fkey" FOREIGN KEY ("actorMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorMembershipId_restaurantId_fkey" FOREIGN KEY ("actorMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_resultOrderId_restaurantId_fkey" FOREIGN KEY ("resultOrderId", "restaurantId") REFERENCES "Order"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
