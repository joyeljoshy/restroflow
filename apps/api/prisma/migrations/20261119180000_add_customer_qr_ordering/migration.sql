-- Part 8 adds separate, revocable customer authorization without changing
-- existing staff sessions or historical order data.
ALTER TABLE "Restaurant" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CustomerOrderingSession" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableSessionId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerOrderingSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerOrderingSession_expiration_check" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "TableOrderingActivation" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableSessionId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableOrderingActivation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TableOrderingActivation_attempts_check" CHECK ("failedAttempts" >= 0),
    CONSTRAINT "TableOrderingActivation_expiration_check" CHECK ("expiresAt" > "createdAt")
);

ALTER TABLE "Order" ALTER COLUMN "createdByMembershipId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "customerOrderingSessionId" UUID;
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "actorMembershipId" DROP NOT NULL;
ALTER TABLE "OrderStatusHistory" ADD COLUMN "customerOrderingSessionId" UUID;
ALTER TABLE "IdempotencyKey" ALTER COLUMN "actorMembershipId" DROP NOT NULL;
ALTER TABLE "IdempotencyKey" ADD COLUMN "customerOrderingSessionId" UUID;

CREATE UNIQUE INDEX "CustomerOrderingSession_tokenHash_key" ON "CustomerOrderingSession"("tokenHash");
CREATE UNIQUE INDEX "CustomerOrderingSession_id_restaurantId_key" ON "CustomerOrderingSession"("id", "restaurantId");
CREATE INDEX "CustomerOrderingSession_restaurantId_tableSessionId_idx" ON "CustomerOrderingSession"("restaurantId", "tableSessionId");
CREATE INDEX "CustomerOrderingSession_expiresAt_idx" ON "CustomerOrderingSession"("expiresAt");
CREATE INDEX "CustomerOrderingSession_revokedAt_idx" ON "CustomerOrderingSession"("revokedAt");
CREATE INDEX "TableOrderingActivation_restaurantId_tableSessionId_expiresAt_idx" ON "TableOrderingActivation"("restaurantId", "tableSessionId", "expiresAt");
CREATE INDEX "TableOrderingActivation_expiresAt_idx" ON "TableOrderingActivation"("expiresAt");
CREATE UNIQUE INDEX "TableOrderingActivation_active_session_key"
  ON "TableOrderingActivation"("tableSessionId") WHERE "revokedAt" IS NULL;
CREATE INDEX "Order_customerOrderingSessionId_createdAt_idx" ON "Order"("customerOrderingSessionId", "createdAt");
CREATE INDEX "OrderStatusHistory_customerOrderingSessionId_createdAt_idx" ON "OrderStatusHistory"("customerOrderingSessionId", "createdAt");
CREATE UNIQUE INDEX "IdempotencyKey_restaurantId_customerOrderingSessionId_key_key"
  ON "IdempotencyKey"("restaurantId", "customerOrderingSessionId", "key");

ALTER TABLE "CustomerOrderingSession" ADD CONSTRAINT "CustomerOrderingSession_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderingSession" ADD CONSTRAINT "CustomerOrderingSession_tableSessionId_restaurantId_fkey"
  FOREIGN KEY ("tableSessionId", "restaurantId") REFERENCES "TableSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableOrderingActivation" ADD CONSTRAINT "TableOrderingActivation_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableOrderingActivation" ADD CONSTRAINT "TableOrderingActivation_tableSessionId_restaurantId_fkey"
  FOREIGN KEY ("tableSessionId", "restaurantId") REFERENCES "TableSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerOrderingSessionId_restaurantId_fkey"
  FOREIGN KEY ("customerOrderingSessionId", "restaurantId") REFERENCES "CustomerOrderingSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_customerOrderingSessionId_restaurantId_fkey"
  FOREIGN KEY ("customerOrderingSessionId", "restaurantId") REFERENCES "CustomerOrderingSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_customerOrderingSessionId_restaurantId_fkey"
  FOREIGN KEY ("customerOrderingSessionId", "restaurantId") REFERENCES "CustomerOrderingSession"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_creator_check" CHECK (
  ("source" = 'WAITER' AND "createdByMembershipId" IS NOT NULL AND "customerOrderingSessionId" IS NULL)
  OR ("source" = 'CUSTOMER' AND "createdByMembershipId" IS NULL AND "customerOrderingSessionId" IS NOT NULL)
);
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actor_check" CHECK (
  (("actorMembershipId" IS NOT NULL)::integer + ("customerOrderingSessionId" IS NOT NULL)::integer) = 1
);
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actor_check" CHECK (
  (("actorMembershipId" IS NOT NULL)::integer + ("customerOrderingSessionId" IS NOT NULL)::integer) = 1
);
