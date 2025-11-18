import fs from "fs";
import path from "path";
import YAML from "yaml";

const yamlDir = path.join(__dirname, "..", "templates");
const outFile = path.join(__dirname, "..", "generated-prompts.ts");

const files = fs.readdirSync(yamlDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

type PromptMeta = {
  id: string;
  description: string;
  version: string;
  template: string;
};

const items: PromptMeta[] = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(yamlDir, file), "utf-8");
  const parsed = YAML.parse(raw);

  if (!parsed.id || !parsed.template || !parsed.version || !parsed.description) {
    throw new Error(`${file} is missing 'id' or 'template' or 'description' or 'version'`);
  }

  items.push(parsed);
}

const ts = `
/* AUTO-GENERATED FILE - DO NOT EDIT BY HAND */
/* Generated At: ${new Date().toLocaleString()} */

export const promptTemplates = {
${items
  .map(
    (template) => `  ${template.id}: {
    id: "${template.id}",
    description: "${template.description}",
    version: "${template.version}",
    template:
      ${JSON.stringify(template.template)}
  }`,
  )
  .join(",\n")}
} as const;

export type promptId = keyof typeof promptTemplates;
`;

fs.writeFileSync(outFile, ts.trim(), "utf-8");
console.log("Generated", outFile + "\n");
