-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "priceMinor" INTEGER NOT NULL,
    "imageUrl" VARCHAR(2048),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuItem_priceMinor_check" CHECK ("priceMinor" >= 0)
);

CREATE TABLE "ModifierGroup" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModifierGroup_selection_limits_check" CHECK ("minSelections" >= 0 AND "maxSelections" >= 1 AND "minSelections" <= "maxSelections")
);

CREATE TABLE "Modifier" (
    "id" UUID NOT NULL,
    "modifierGroupId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "priceDeltaMinor" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItemModifierGroup" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "modifierGroupId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuCategory_restaurantId_isActive_sortOrder_idx" ON "MenuCategory"("restaurantId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "MenuCategory_restaurantId_name_key" ON "MenuCategory"("restaurantId", "name");
CREATE UNIQUE INDEX "MenuCategory_id_restaurantId_key" ON "MenuCategory"("id", "restaurantId");
CREATE INDEX "MenuItem_restaurantId_categoryId_isActive_isAvailable_sortO_idx" ON "MenuItem"("restaurantId", "categoryId", "isActive", "isAvailable", "sortOrder");
CREATE INDEX "MenuItem_restaurantId_name_idx" ON "MenuItem"("restaurantId", "name");
CREATE UNIQUE INDEX "MenuItem_id_restaurantId_key" ON "MenuItem"("id", "restaurantId");
CREATE INDEX "ModifierGroup_restaurantId_isActive_name_idx" ON "ModifierGroup"("restaurantId", "isActive", "name");
CREATE UNIQUE INDEX "ModifierGroup_restaurantId_name_key" ON "ModifierGroup"("restaurantId", "name");
CREATE UNIQUE INDEX "ModifierGroup_id_restaurantId_key" ON "ModifierGroup"("id", "restaurantId");
CREATE INDEX "Modifier_modifierGroupId_isAvailable_idx" ON "Modifier"("modifierGroupId", "isAvailable");
CREATE UNIQUE INDEX "Modifier_modifierGroupId_name_key" ON "Modifier"("modifierGroupId", "name");
CREATE INDEX "MenuItemModifierGroup_restaurantId_menuItemId_sortOrder_idx" ON "MenuItemModifierGroup"("restaurantId", "menuItemId", "sortOrder");
CREATE INDEX "MenuItemModifierGroup_restaurantId_modifierGroupId_idx" ON "MenuItemModifierGroup"("restaurantId", "modifierGroupId");
CREATE UNIQUE INDEX "MenuItemModifierGroup_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("menuItemId", "modifierGroupId");

ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_restaurantId_fkey" FOREIGN KEY ("categoryId", "restaurantId") REFERENCES "MenuCategory"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_restaurantId_fkey" FOREIGN KEY ("menuItemId", "restaurantId") REFERENCES "MenuItem"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_restaurantId_fkey" FOREIGN KEY ("modifierGroupId", "restaurantId") REFERENCES "ModifierGroup"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;
