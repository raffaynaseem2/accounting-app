ALTER TABLE "JournalEntry" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "sourceId" TEXT;
CREATE UNIQUE INDEX "JournalEntry_businessId_sourceType_sourceId_key" ON "JournalEntry"("businessId", "sourceType", "sourceId");
