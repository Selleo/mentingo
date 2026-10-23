import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestLocalBuilder } from "@workflow/nest/builder";

const outDir = resolve("dist/workflow");
await new NestLocalBuilder({
  workingDir: process.cwd(),
  dirs: ["src/assistant/workflow"],
  outDir,
  moduleType: "commonjs",
  distDir: "dist/src/assistant/workflow",
  sourcemap: false,
}).build();
const manifest = JSON.parse(await readFile(resolve(outDir, "manifest.json"), "utf8"));
const entries = Object.values(manifest.workflows).flatMap((file) => Object.entries(file));
const entry = entries.find(([name]) => name === "assistantWorkflow")?.[1];
if (!entry?.workflowId) throw new Error("Assistant workflow was not present in generated manifest");
await writeFile(resolve(outDir, "assistant-entry.json"), JSON.stringify(entry));
