-- Replace the Supabase UUID identity with a provider-neutral Clerk user ID.
DROP INDEX "app_users_supabaseUserId_key";

ALTER TABLE "app_users" RENAME COLUMN "supabaseUserId" TO "authUserId";

ALTER TABLE "app_users"
  ALTER COLUMN "authUserId" TYPE TEXT
  USING "authUserId"::text;

CREATE UNIQUE INDEX "app_users_authUserId_key" ON "app_users"("authUserId");
