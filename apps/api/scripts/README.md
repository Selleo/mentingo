# Content Migration Script

To migrate lesson types, run the following command from the `apps/api` directory.

> **Note:** Run this script only once. It will update only lesson records with a `null` description. For articles and news, all resource URLs will be redirected to the new endpoint, and previous links will be tagged with the required attributes for compatibility with the new editor.

```sh
npx tsx ./scripts/migrateContent.ts --url=https://instanceApiUrl
```
