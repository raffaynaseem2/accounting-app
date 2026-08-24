DO $$ BEGIN
  CREATE TYPE "SubledgerType" AS ENUM ('NONE', 'CUSTOMER', 'SUPPLIER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Account" ADD COLUMN "subledgerType" "SubledgerType" NOT NULL DEFAULT 'NONE';

CREATE TABLE "Customer" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "billingAddress" TEXT,
  "paymentTerms" "PaymentTerms",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivableAccountId" UUID,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "billingAddress" TEXT,
  "paymentTerms" "PaymentTerms",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payableAccountId" UUID,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Customer" ("id", "businessId", "name", "contactEmail", "contactPhone", "billingAddress", "paymentTerms", "isActive", "createdAt", "receivableAccountId")
SELECT "id", "businessId", "name", "contactEmail", "contactPhone", "billingAddress", "paymentTerms", "isActive", "createdAt", "parentAccountId"
FROM "Account" WHERE "subAccountKind" = 'CUSTOMER';

INSERT INTO "Supplier" ("id", "businessId", "name", "contactEmail", "contactPhone", "billingAddress", "paymentTerms", "isActive", "createdAt", "payableAccountId")
SELECT "id", "businessId", "name", "contactEmail", "contactPhone", "billingAddress", "paymentTerms", "isActive", "createdAt", "parentAccountId"
FROM "Account" WHERE "subAccountKind" = 'SUPPLIER';

ALTER TABLE "JournalEntryLine" ADD COLUMN "customerId" UUID;
ALTER TABLE "JournalEntryLine" ADD COLUMN "supplierId" UUID;

ALTER TABLE "SalesInvoice" DROP CONSTRAINT "SalesInvoice_customerId_fkey";
ALTER TABLE "PurchaseBill" DROP CONSTRAINT "PurchaseBill_supplierId_fkey";

UPDATE "JournalEntryLine" line
SET "customerId" = line."accountId", "accountId" = account."parentAccountId"
FROM "Account" account
WHERE line."accountId" = account."id" AND account."subAccountKind" = 'CUSTOMER';

UPDATE "JournalEntryLine" line
SET "supplierId" = line."accountId", "accountId" = account."parentAccountId"
FROM "Account" account
WHERE line."accountId" = account."id" AND account."subAccountKind" = 'SUPPLIER';

UPDATE "Account" SET "subledgerType" = 'CUSTOMER' WHERE "systemKey" = 'AR';
UPDATE "Account" SET "subledgerType" = 'SUPPLIER' WHERE "systemKey" = 'AP';

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Customer_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Supplier_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntryLine"
  ADD CONSTRAINT "JournalEntryLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "JournalEntryLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");
CREATE INDEX "Customer_receivableAccountId_idx" ON "Customer"("receivableAccountId");
CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");
CREATE INDEX "Supplier_payableAccountId_idx" ON "Supplier"("payableAccountId");
CREATE INDEX "JournalEntryLine_customerId_idx" ON "JournalEntryLine"("customerId");
CREATE INDEX "JournalEntryLine_supplierId_idx" ON "JournalEntryLine"("supplierId");

DELETE FROM "Account" WHERE "subAccountKind" IS NOT NULL;
ALTER TABLE "Account" DROP COLUMN "isSubAccount", DROP COLUMN "subAccountKind", DROP COLUMN "contactEmail", DROP COLUMN "contactPhone", DROP COLUMN "billingAddress", DROP COLUMN "paymentTerms";
DROP TYPE "SubAccountKind";
