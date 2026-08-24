ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'SALES_REVENUE';
ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'GENERAL_EXPENSE';

INSERT INTO "Account" ("id", "businessId", "name", "type", "systemKey", "subledgerType", "isActive", "createdAt")
SELECT gen_random_uuid(), b."id", 'Sales Revenue', 'REVENUE', 'SALES_REVENUE', 'NONE', true, NOW()
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."businessId" = b."id" AND a."systemKey" = 'SALES_REVENUE'
);

INSERT INTO "Account" ("id", "businessId", "name", "type", "systemKey", "subledgerType", "isActive", "createdAt")
SELECT gen_random_uuid(), b."id", 'General Expense', 'EXPENSE', 'GENERAL_EXPENSE', 'NONE', true, NOW()
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."businessId" = b."id" AND a."systemKey" = 'GENERAL_EXPENSE'
);
