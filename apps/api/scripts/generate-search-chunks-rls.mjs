import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// drizzle-kit owns naming and journal registration; generate the unsupported RLS SQL reproducibly.
execFileSync(
  "pnpm",
  ["exec", "drizzle-kit", "generate", "--custom", "--name=enable_search_chunks_rls"],
  { stdio: "inherit" },
);
const journal = JSON.parse(readFileSync("src/storage/migrations/meta/_journal.json", "utf8"));
const entry = journal.entries.at(-1);
if (!entry.tag.endsWith("enable_search_chunks_rls"))
  throw new Error("Unexpected generated migration");
const table = "search_chunks";
writeFileSync(
  `src/storage/migrations/${entry.tag}.sql`,
  `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;\n--> statement-breakpoint\nCREATE POLICY "${table}_tenant_isolation" ON "${table}" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);\n`,
);
