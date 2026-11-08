ALTER TABLE "Account" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Account" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "odooAccountId" TEXT;
ALTER TABLE "Account" ADD COLUMN "odooAccountType" TEXT;
ALTER TABLE "Account" ADD COLUMN "odooBalance" DECIMAL(19,4);
ALTER TABLE "Account" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Account_odooAccountId_key" ON "Account"("odooAccountId");
CREATE INDEX "Account_isGlobal_idx" ON "Account"("isGlobal");
