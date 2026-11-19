-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- The compound key keeps staff/session relationships restaurant-scoped.
CREATE UNIQUE INDEX "StaffMembership_id_restaurantId_key" ON "StaffMembership"("id", "restaurantId");

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableNumber" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "qrIdentifier" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RestaurantTable_capacity_check" CHECK ("capacity" > 0)
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openedByMembershipId" UUID NOT NULL,
    "closedByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TableSession_status_dates_check" CHECK (
      ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedByMembershipId" IS NULL)
      OR
      ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedByMembershipId" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_qrIdentifier_key" ON "RestaurantTable"("qrIdentifier");
CREATE UNIQUE INDEX "RestaurantTable_restaurantId_tableNumber_key" ON "RestaurantTable"("restaurantId", "tableNumber");
CREATE UNIQUE INDEX "RestaurantTable_id_restaurantId_key" ON "RestaurantTable"("id", "restaurantId");
CREATE INDEX "RestaurantTable_restaurantId_isActive_tableNumber_idx" ON "RestaurantTable"("restaurantId", "isActive", "tableNumber");
CREATE UNIQUE INDEX "TableSession_id_restaurantId_key" ON "TableSession"("id", "restaurantId");
CREATE INDEX "TableSession_restaurantId_status_openedAt_idx" ON "TableSession"("restaurantId", "status", "openedAt");
CREATE INDEX "TableSession_tableId_openedAt_idx" ON "TableSession"("tableId", "openedAt");
CREATE INDEX "TableSession_openedByMembershipId_idx" ON "TableSession"("openedByMembershipId");
CREATE INDEX "TableSession_closedByMembershipId_idx" ON "TableSession"("closedByMembershipId");

-- PostgreSQL is the concurrency backstop: application pre-checks improve the
-- error message, while this partial index prevents two simultaneous opens.
CREATE UNIQUE INDEX "TableSession_one_open_per_table_key" ON "TableSession"("tableId") WHERE "closedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_restaurantId_fkey" FOREIGN KEY ("tableId", "restaurantId") REFERENCES "RestaurantTable"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_openedByMembershipId_restaurantId_fkey" FOREIGN KEY ("openedByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_closedByMembershipId_restaurantId_fkey" FOREIGN KEY ("closedByMembershipId", "restaurantId") REFERENCES "StaffMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
