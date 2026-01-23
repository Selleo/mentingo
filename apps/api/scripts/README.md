# Content Migration Script

To migrate lesson types, run the following command from the `apps/api` directory.

> **Note:** Run this script only once. It will update only lesson records with a `null` description. For articles and news, all resource URLs will be redirected to the new endpoint, and previous links will be tagged with the required attributes for compatibility with the new editor.

> **Options:** Use `--specific` or `-s` with any combination of `l` (lessons), `n` (news), or `a` (articles) to migrate specific types. If unset, all types will be migrated.

```sh
npx tsx ./scripts/migrateContent.ts --url=https://instanceApiUrl --specific=lna
```
