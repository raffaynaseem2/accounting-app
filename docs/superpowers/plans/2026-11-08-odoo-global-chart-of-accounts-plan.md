# Odoo Global Chart of Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the enterprise Odoo Chart of Accounts into one shared global account set visible to every Ledgerly user.

**Architecture:** Add a small XML-RPC adapter layer in NestJS, transform Odoo account records into a typed decimal-safe DTO, and upsert them into global `Account` rows identified by `odooAccountId`. Update existing account reads and journal validation to include global rows while keeping local accounts and journal data user-scoped.

**Tech Stack:** NestJS, Prisma 7, Neon PostgreSQL, Clerk guards, Jest, Node `xmlrpc` client.

**Spec:** `docs/superpowers/specs/2026-11-08-odoo-global-chart-of-accounts-design.md`

## Global Constraints

- Synchronize only Odoo `account.account` in this phase.
- Request only `id`, `code`, `name`, `account_type`, and `current_balance`.
- Never log `ODOO_API_KEY` or raw XML-RPC authorization data.
- Use `Prisma.Decimal` for Odoo balances and never route money through JavaScript `number` arithmetic.
- Odoo-synchronized accounts are global and visible to all authenticated users.
- The sync is admin-only and runs only through `POST /sync/chart-of-accounts`.
- Missing Odoo accounts are not deleted from Neon.
- No startup sync and no frontend Odoo calls.

## Review Focus

- Existing local accounts must remain visible and user-owned after `Account.userId` becomes nullable; test the visibility predicate in account list and form options.
- A global Odoo account must be accepted by journal validation for any user without allowing cross-user local accounts; test both paths.
- Repeating sync must update one row rather than duplicate it; test by Odoo ID and code changes.
- Large decimal balances must retain exact text precision; test values with four fractional digits and large integer parts.
- Unsupported or missing Odoo account types must be skipped with a useful summary rather than silently mapped to the wrong Ledgerly type.

### Task 1: Odoo XML-RPC adapter

**Files:**
- Create: `backend/src/odoo/odoo.module.ts`
- Create: `backend/src/odoo/odoo.service.ts`
- Create: `backend/src/odoo/odoo.service.spec.ts`
- Modify: `backend/package.json`, `backend/package-lock.json`, `backend/src/app.module.ts`

**Interfaces:**
- Produces `OdooService.authenticate(): Promise<number>`.
- Produces `OdooService.executeKw<T>(model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<T>`.
- Uses `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, and `ODOO_API_KEY`.

- [ ] Write failing tests for missing configuration, authentication failure, and an `execute_kw` call using only safe logs.
- [ ] Run `npm.cmd test -- --runInBand src/odoo/odoo.service.spec.ts` and confirm the expected failures.
- [ ] Add the XML-RPC dependency and implement separate common/object endpoint clients with timeout and structured NestJS errors.
- [ ] Run the focused tests and confirm authentication and execute_kw behavior passes.
- [ ] Register `OdooModule` in `AppModule` and run the backend test suite.

### Task 2: Account DTO and transformation

**Files:**
- Create: `backend/src/odoo/chart-of-accounts.dto.ts`
- Create: `backend/src/odoo/chart-of-accounts.transformer.ts`
- Create: `backend/src/odoo/chart-of-accounts.transformer.spec.ts`

**Interfaces:**
- Consumes raw Odoo rows with `id`, `code`, `name`, `account_type`, and `current_balance`.
- Produces `OdooAccountDto` with `odooAccountId`, `code`, `name`, `odooAccountType`, `type`, and `odooBalance: Prisma.Decimal`.

- [ ] Write failing tests for every supported account-type family, unsupported types, malformed IDs/names, and exact decimal parsing.
- [ ] Run the transformer test and confirm it fails before implementation.
- [ ] Implement explicit Odoo-to-Ledgerly type mapping and decimal-safe parsing; unsupported rows should return a skip reason.
- [ ] Run the focused transformer tests and confirm they pass.

### Task 3: Global Account schema and visibility

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_global_odoo_accounts/migration.sql`
- Create or modify: `backend/src/accounts/account-scope.ts` and account-related tests
- Modify: `backend/src/accounts/accounts.service.ts`, `backend/src/journal-entries/journal-entries.service.ts`, `backend/src/payments/payments.service.ts`, and document/journal form-option queries as required

**Interfaces:**
- Global account predicate: `{ OR: [{ userId }, { isGlobal: true }] }`.
- Odoo sync writes `userId = null`, `isGlobal = true`, and a unique `odooAccountId`.

- [ ] Write failing tests proving global accounts are visible to two users while local accounts remain isolated.
- [ ] Run focused account tests and confirm the current user-only behavior fails the new global-account expectations.
- [ ] Add nullable `userId`, `isGlobal`, `odooAccountId`, `odooAccountType`, `odooBalance`, and `lastSyncedAt`; add the global Odoo ID uniqueness constraint and indexes.
- [ ] Update account reads and journal account validation to use the shared visibility predicate without weakening customer/supplier ownership checks.
- [ ] Generate and inspect the migration SQL; verify it preserves existing rows and journal lines.
- [ ] Run account, journal, and full backend tests.

### Task 4: Global CoA synchronization service

**Files:**
- Create: `backend/src/odoo/chart-of-accounts.service.ts`
- Create: `backend/src/odoo/chart-of-accounts.service.spec.ts`

**Interfaces:**
- Produces `sync(userId: string): Promise<{ fetched: number; created: number; updated: number; skipped: Array<{ id: string; reason: string }>; syncedAt: Date }>`.
- Calls `OdooService.executeKw("account.account", "search_read", ...)` with the exact selective field list.

- [ ] Write failing tests for exact Odoo query fields, create, update, idempotent repeat, skipped unsupported rows, and Neon failure propagation.
- [ ] Run the focused service test and confirm it fails before implementation.
- [ ] Implement the Odoo query, DTO transformation, and Prisma transaction that upserts global accounts by `odooAccountId`.
- [ ] Ensure synced records update code/name/type/balance/timestamp but do not modify Ledgerly journal lines.
- [ ] Run focused and full backend tests.

### Task 5: Protected sync endpoint

**Files:**
- Create: `backend/src/odoo/chart-of-accounts.controller.ts`
- Modify: `backend/src/odoo/odoo.module.ts`
- Create or modify: `backend/src/odoo/chart-of-accounts.controller.spec.ts`

**Interfaces:**
- Route: `POST /sync/chart-of-accounts`.
- Authentication: existing `AuthGuard`.
- Authorization: `ADMIN` application role.

- [ ] Write failing tests for unauthenticated, non-admin, and admin requests.
- [ ] Run focused controller tests and confirm the authorization failures are captured.
- [ ] Implement the guarded controller and return the sync summary as JSON.
- [ ] Run controller and full backend tests.

### Task 6: Deployment and documentation verification

**Files:**
- Modify: `backend/.env.example`, `backend/README.md`
- Modify: `docs/superpowers/specs/2026-11-08-odoo-global-chart-of-accounts-design.md` only if implementation decisions materially change

- [ ] Document the four Odoo variables without real credentials.
- [ ] Run `npm.cmd run build` and `npm.cmd test -- --runInBand` from `backend`.
- [ ] Run `npx.cmd prisma validate` and inspect migration status locally.
- [ ] Confirm no frontend code or Odoo credentials are added to the repository.
- [ ] Provide the Neon migration deployment command and the protected endpoint test command for the user.

