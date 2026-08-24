-- Payment document linking removed (balance-forward model)
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_salesInvoiceId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_purchaseBillId_fkey";
DROP INDEX IF EXISTS "Payment_salesInvoiceId_idx";
DROP INDEX IF EXISTS "Payment_purchaseBillId_idx";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "salesInvoiceId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "purchaseBillId";

-- Document status removed; invoices/bills are active on save
ALTER TABLE "SalesInvoice" DROP COLUMN IF EXISTS "status";
ALTER TABLE "PurchaseBill" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "SalesInvoiceStatus";
DROP TYPE IF EXISTS "PurchaseBillStatus";

-- Opening Balance Equity system account key
ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE_EQUITY';
