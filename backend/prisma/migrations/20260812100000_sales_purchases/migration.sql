DO $$ BEGIN
  CREATE TYPE "SalesInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "PurchaseBillStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "SalesInvoice" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesInvoiceLine" (
  "id" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "itemName" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "unitPrice" DECIMAL(19,4) NOT NULL,
  "lineTotal" DECIMAL(19,4) NOT NULL,
  CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseBill" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "billNumber" TEXT NOT NULL,
  "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "PurchaseBillStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseBillLine" (
  "id" UUID NOT NULL,
  "billId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "itemName" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "unitCost" DECIMAL(19,4) NOT NULL,
  "lineTotal" DECIMAL(19,4) NOT NULL,
  CONSTRAINT "PurchaseBillLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesInvoice_businessId_invoiceNumber_key" ON "SalesInvoice"("businessId", "invoiceNumber");
CREATE INDEX "SalesInvoice_businessId_issueDate_idx" ON "SalesInvoice"("businessId", "issueDate");
CREATE INDEX "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");
CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "SalesInvoiceLine"("invoiceId");
CREATE INDEX "SalesInvoiceLine_itemId_idx" ON "SalesInvoiceLine"("itemId");
CREATE UNIQUE INDEX "PurchaseBill_businessId_billNumber_key" ON "PurchaseBill"("businessId", "billNumber");
CREATE INDEX "PurchaseBill_businessId_billDate_idx" ON "PurchaseBill"("businessId", "billDate");
CREATE INDEX "PurchaseBill_supplierId_idx" ON "PurchaseBill"("supplierId");
CREATE INDEX "PurchaseBillLine_billId_idx" ON "PurchaseBillLine"("billId");
CREATE INDEX "PurchaseBillLine_itemId_idx" ON "PurchaseBillLine"("itemId");

ALTER TABLE "SalesInvoice"
  ADD CONSTRAINT "SalesInvoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoiceLine"
  ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SalesInvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseBill"
  ADD CONSTRAINT "PurchaseBill_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseBillLine"
  ADD CONSTRAINT "PurchaseBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseBillLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
