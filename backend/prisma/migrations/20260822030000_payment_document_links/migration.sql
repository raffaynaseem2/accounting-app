ALTER TABLE "Payment" ADD COLUMN "salesInvoiceId" UUID;
ALTER TABLE "Payment" ADD COLUMN "purchaseBillId" UUID;

CREATE INDEX "Payment_salesInvoiceId_idx" ON "Payment"("salesInvoiceId");
CREATE INDEX "Payment_purchaseBillId_idx" ON "Payment"("purchaseBillId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_salesInvoiceId_fkey"
  FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseBillId_fkey"
  FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
