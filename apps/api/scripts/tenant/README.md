# updateLegacyTenantNameAndHost

Simple one-off script to rename the legacy tenant (host `legacy.local`) after backfilling tenant IDs.

## When to use

- After running migration `0081_backfill_tenant_ids.sql` to ensure the legacy tenant gets the new public-facing name/host.
- Only for the single legacy tenant; for arbitrary tenants use `apps/api/scripts/updateTenantNameAndHost.ts`.

## Prerequisites

- `.env` in `apps/api` with a valid `DATABASE_URL`.
- Migrations applied so the `tenants` table exists and contains the `legacy.local` row.

## Usage

From `apps/api`:

```sh
npx tsx ./scripts/tenant/updateLegacyTenantNameAndHost.ts --new-name="New Tenant Name" --new-host="new.example.com"
```

Or when built

```sh
node ./dist/scripts/tenant/updateLegacyTenantNameAndHost.js --new-name="New Tenant Name" --new-host="new.example.com"
```

### Flags

- `--new-name` / `-n` — required; new tenant display name.
- `--new-host` / `-nh` — required; new tenant hostname (must be unique).

## Safety notes

- Script selects the tenant by host `legacy.local`; it will exit if not found.
- Does not run if the required flags are missing.
- No automatic rollback; verify the values before running.
