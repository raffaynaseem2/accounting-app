DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "SubAccountKind" AS ENUM ('CUSTOMER', 'SUPPLIER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "SystemAccountKey" AS ENUM ('AR', 'AP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentTerms" AS ENUM ('DUE_ON_RECEIPT', 'NET_15', 'NET_30', 'NET_60');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "JournalSide" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "Account" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "parentAccountId" UUID,
  "isSubAccount" BOOLEAN NOT NULL DEFAULT false,
  "subAccountKind" "SubAccountKind",
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "billingAddress" TEXT,
  "paymentTerms" "PaymentTerms",
  "systemKey" "SystemAccountKey",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalEntry" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalEntryLine" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "journalEntryId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "side" "JournalSide" NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "description" TEXT,
  CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_businessId_systemKey_key" ON "Account"("businessId", "systemKey");
CREATE UNIQUE INDEX "Account_businessId_code_key" ON "Account"("businessId", "code");
CREATE INDEX "Account_businessId_idx" ON "Account"("businessId");
CREATE INDEX "Account_parentAccountId_idx" ON "Account"("parentAccountId");
CREATE INDEX "JournalEntry_businessId_entryDate_idx" ON "JournalEntry"("businessId", "entryDate");
CREATE INDEX "JournalEntryLine_businessId_idx" ON "JournalEntryLine"("businessId");
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Account_parentAccountId_fkey"
  FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalEntryLine"
  ADD CONSTRAINT "JournalEntryLine_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "JournalEntryLine_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Account" ("id", "businessId", "name", "type", "systemKey", "isSubAccount")
SELECT gen_random_uuid(), b."id", 'Accounts Receivable', 'ASSET', 'AR', false
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."businessId" = b."id" AND a."systemKey" = 'AR'
);

INSERT INTO "Account" ("id", "businessId", "name", "type", "systemKey", "isSubAccount")
SELECT gen_random_uuid(), b."id", 'Accounts Payable', 'LIABILITY', 'AP', false
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."businessId" = b."id" AND a."systemKey" = 'AP'
);
