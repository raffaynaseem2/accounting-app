# Odoo Global Chart of Accounts Design

## Intent

Synchronize the single enterprise Odoo Chart of Accounts into Ledgerly so every authenticated Ledgerly user sees the same Odoo-backed accounts. This first integration is limited to `account.account`; it does not import invoices, bills, journal items, customers, suppliers, or inventory.

The sync is initiated by an authenticated backend request and stores only the fields Ledgerly needs: Odoo account identity, code, name, mapped Ledgerly type, Odoo balance, and sync timestamp.

## Goals

- Authenticate to Odoo through XML-RPC using backend environment variables.
- Query only `account.account` and only the required fields.
- Upsert accounts globally by immutable `odooAccountId`.
- Preserve exact financial values with Prisma `Decimal`.
- Make synchronized accounts visible to all Ledgerly users.
- Keep Odoo credentials and raw XML-RPC responses server-side.
- Return a useful sync summary and structured errors.
- Add unit tests for authentication, mapping, precision, upsert behavior, and failure handling.

## Non-goals

- Importing Odoo invoices, bills, journal items, payments, contacts, or inventory.
- Creating Ledgerly journal entries from Odoo balances.
- Replacing Odoo’s native interface.
- Deleting Ledgerly accounts that are absent from an Odoo response.
- Treating Odoo balances as Ledgerly journal-derived balances.

## Chosen Approach

Use the existing `Account` model with explicit Odoo mapping fields and a global-account visibility flag. Existing Ledgerly-created accounts remain user-owned. Odoo-synchronized accounts are global records with no owning Ledgerly user and are visible to every authenticated user.

This avoids duplicating the same Odoo account for every Clerk user while preserving the existing per-user accounting data model for local accounts and journal entries.

## Data Model

Modify `Account` as follows:

- `userId String?`: nullable for global Odoo accounts; remains populated for local accounts.
- `isGlobal Boolean @default(false)`: true only for globally synchronized Odoo accounts.
- `odooAccountId String? @unique`: immutable Odoo `account.account` identifier.
- `odooAccountType String?`: original Odoo `account_type` value.
- `odooBalance Decimal? @db.Decimal(19, 4)`: latest Odoo balance, never converted through JavaScript `number`.
- `lastSyncedAt DateTime?`: timestamp of the successful account sync.

The existing local `balance` calculation remains based on Ledgerly journal lines. Odoo’s balance is displayed separately or labeled as the Odoo balance; the sync must never create fake journal lines to represent it.

Existing account queries must use an authenticated-user visibility scope:

- local records: `userId = currentUserId`
- global Odoo records: `isGlobal = true`

Account creation, update, deactivate, and delete operations must continue to operate only on local user-owned records unless an explicit Odoo-management operation is added later. Global Odoo records are managed by synchronization.

The migration must preserve all existing accounts and journal lines. It must not reset or delete Neon data.

## Odoo Client Boundary

Create an `OdooModule` exporting `OdooService`.

`OdooService` will:

1. Read `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, and `ODOO_API_KEY` from `process.env`.
2. Validate that all required values exist without logging secrets.
3. Authenticate against `${ODOO_URL}/xmlrpc/2/common`.
4. Execute model calls against `${ODOO_URL}/xmlrpc/2/object` using `execute_kw`.
5. Apply request timeouts and convert XML-RPC failures into NestJS exceptions.
6. Log operation name, duration, and safe error metadata only.

The XML-RPC dependency will be added to the backend package and its types handled explicitly if the package has incomplete TypeScript definitions.

## Field Extraction and Transformation

The Odoo query will request only:

- `id`
- `code`
- `name`
- `account_type`
- `current_balance`

The service may first inspect `fields_get` only to determine whether `current_balance` is available. It must not fetch journal items as a fallback in this phase. If Odoo does not expose the requested balance field, the sync will return a clear warning and store a null or zero balance according to the finalized implementation contract rather than silently querying unrelated models.

The transformer will produce a typed internal DTO:

- `odooAccountId: string`
- `code: string | null`
- `name: string`
- `odooAccountType: string`
- `type: AccountType`
- `odooBalance: Prisma.Decimal`

Odoo account categories will map to Ledgerly’s five account types: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, and `EXPENSE`. Unsupported categories such as off-balance-sheet accounts will be reported as skipped rather than silently misclassified.

Balances will be parsed directly into `Prisma.Decimal` from the XML-RPC value. No `parseFloat`, arithmetic through JavaScript numbers, or JSON round-trip will be used for money.

## Sync Endpoint

Add a protected endpoint:

```text
POST /sync/chart-of-accounts
```

The current NestJS application has no global `/api` prefix, so this path matches the existing backend route convention.

The endpoint will:

1. Require a valid Clerk bearer token.
2. Require the `ADMIN` application role to prevent concurrent or accidental global syncs.
3. Fetch and transform Odoo accounts.
4. Upsert each account by `odooAccountId`.
5. Set `isGlobal = true`, clear `userId`, and update the Odoo fields.
6. Never delete records absent from the response.
7. Return counts for fetched, created, updated, skipped, and failed records.

The sync must be idempotent: running it twice with unchanged Odoo data must not create duplicates or change Ledgerly journal lines.

## Error Handling

Errors will be separated into:

- missing or invalid Odoo environment variables;
- Odoo authentication failure;
- XML-RPC connection, timeout, or protocol failure;
- malformed Odoo account data;
- unsupported account type;
- Neon upsert failure;
- authorization failure for non-admin users.

The global JSON exception filter will return JSON responses. Logs will include the operation and safe identifiers, but never the Odoo API key, password, or full authorization payload.

## Tests

Unit tests will cover:

- Odoo authentication success and failure.
- Required environment-variable validation.
- The exact selective field list sent to Odoo.
- Account type mappings, including unsupported types.
- Decimal balance preservation such as `1000000000.1234`.
- First sync creates global accounts.
- Repeated sync updates existing accounts without duplicates.
- Missing Odoo records are not deleted.
- Non-admin access is rejected.
- Odoo and database failures return structured errors.

## Deployment and Migration Safety

This requires one Prisma migration because the `Account` table changes. The migration will be additive/nullable except for making `userId` nullable, preserving existing rows. It must be reviewed before `prisma migrate deploy` is run against Neon.

The implementation will not run automatically on application startup. The sync will run only when an admin explicitly calls the endpoint.

## Open Decision Resolved by This Design

Odoo is the single enterprise source of truth for synchronized accounts. All Ledgerly users see the same global Odoo account records, while their existing local accounts and journal data remain user-scoped.
