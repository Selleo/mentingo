import { writeFile } from "node:fs";

const DEFAULT_SCHEMA_FILE = "./src/swagger/api-schema.json";

export const exportSchemaToFile = (schema: object, filePath: string = DEFAULT_SCHEMA_FILE) => {
  const content = JSON.stringify(schema, null, 2);

  writeFile(filePath, content, (err) => {
    if (err) {
      return console.error(err);
    }
  });
};
