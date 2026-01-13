# Lesson Types Migration Script

To migrate lesson types, run the following command from the `apps/api` directory.

> **Note:** Run this script only once. It will only overwrite records where the description is `null`.

```sh
npx tsx ./scripts/migrateLessonTypes.ts --url=https://instanceApiUrl
```
