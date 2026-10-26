# Content Migration Script

To migrate lesson types, run the following command from the `apps/api` directory.

> **Note:** Run this script only once. It will update only lesson records with a `null` description. For articles and news, all resource URLs will be redirected to the new endpoint, and previous links will be tagged with the required attributes for compatibility with the new editor.

> **Options:** Use `--specific` or `-s` with any combination of `l` (lessons), `n` (news), or `a` (articles) to migrate specific types. If unset, all types will be migrated.

```sh
npx tsx ./scripts/migrateContent.ts --url=https://instanceUrl --specific=lna
```

# Autoplay Migration Script

Autoplay uses a new attribute to know each action. In order to set that attribute, you need to just save each lesson. To avoid doing that manually run this script.

> **Note:** This script is idempotent, so you can run it multiple times without causing duplicate changes.

```sh
npx tsx ./scripts/migrateAutoplay.ts
```

# Image Variant Migration Script

Backfills stored image references to the image variant format. The script is idempotent: old
original image references are converted to new variant references, and existing variant references
are repaired when one of the expected sizes is missing.

> **Note:** Legacy original S3 objects are kept for rollback. Unsupported formats, remote URLs, and
> Bunny video references are skipped.

```sh
npx tsx ./scripts/migrateImageVariants.ts
```

# Content Marketplace Mock

Runs a local fake of the content marketplace plugin and connects a local tenant to it, so the
marketplace UI can be tested without a real plugin. It serves fixture listings with generated
thumbnails and supports search, category, duration, sort and pagination.

> **Note:** Development only. The tenant connection is written straight into the `secrets` table
> using `MASTER_KEY` from `.env`. Copying a listing needs a real course export: pass
> `--archive=<path>`; without it copies fail with a missing archive.

```sh
pnpm content-marketplace:mock -- --tenant=localhost:5173 --port=4010 --archive=./course-export.zip
```

`--tenant` is the tenant host (defaults to the oldest tenant) and `--port` defaults to `4010`.
