DO $$ BEGIN
  CREATE TYPE "ItemType" AS ENUM ('GOOD', 'SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "InventoryMovementReason" AS ENUM ('OPENING_BALANCE', 'PURCHASE', 'SALE', 'MANUAL_ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "Item" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ItemType" NOT NULL,
  "productCode" TEXT NOT NULL,
  "description" TEXT,
  "unitCost" DECIMAL(19,4),
  "unitPrice" DECIMAL(19,4),
  "quantityOnHand" DECIMAL(19,4),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "reason" "InventoryMovementReason" NOT NULL,
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Item_businessId_productCode_key" ON "Item"("businessId", "productCode");
CREATE INDEX "Item_businessId_type_idx" ON "Item"("businessId", "type");
CREATE INDEX "InventoryMovement_businessId_createdAt_idx" ON "InventoryMovement"("businessId", "createdAt");
CREATE INDEX "InventoryMovement_itemId_createdAt_idx" ON "InventoryMovement"("itemId", "createdAt");

ALTER TABLE "Item"
  ADD CONSTRAINT "Item_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryMovement_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
