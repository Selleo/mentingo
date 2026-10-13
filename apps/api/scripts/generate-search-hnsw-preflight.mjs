import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Keep unsupported extension-version preflight SQL reproducible; Drizzle owns the migration journal.
execFileSync(
  "pnpm",
  ["exec", "drizzle-kit", "generate", "--custom", "--name=require_pgvector_iterative_scan"],
  { stdio: "inherit" },
);
const journal = JSON.parse(readFileSync("src/storage/migrations/meta/_journal.json", "utf8"));
const entry = journal.entries.at(-1);
if (!entry.tag.endsWith("require_pgvector_iterative_scan"))
  throw new Error("Unexpected generated migration");
writeFileSync(
  `src/storage/migrations/${entry.tag}.sql`,
  `DO $$
DECLARE
  installed_version text;
  version_parts text[];
BEGIN
  SELECT extversion INTO installed_version FROM pg_extension WHERE extname = 'vector';
  version_parts := regexp_match(coalesce(installed_version, ''), '^([0-9]+)\\.([0-9]+)');
  IF version_parts IS NULL OR (version_parts[1]::integer = 0 AND version_parts[2]::integer < 8) THEN
    RAISE EXCEPTION 'Hybrid search requires pgvector >= 0.8.0 for strict iterative HNSW scans; installed version: %. Upgrade the database pgvector extension before retrying migrations.', coalesce(installed_version, 'not installed');
  END IF;
END $$;
`,
);
