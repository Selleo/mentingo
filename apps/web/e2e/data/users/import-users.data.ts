import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USERS_IMPORT_FILES_DIR = resolve(__dirname, "files");

export const USERS_IMPORT_FILE_TEMPLATES = {
  SUCCESS: resolve(USERS_IMPORT_FILES_DIR, "users-import-success.csv"),
  DUPLICATE: resolve(USERS_IMPORT_FILES_DIR, "users-import-duplicate.csv"),
  INVALID: resolve(USERS_IMPORT_FILES_DIR, "users-import-invalid.csv"),
  UNKNOWN_GROUPS: resolve(USERS_IMPORT_FILES_DIR, "users-import-unknown-groups.csv"),
} as const;

type UsersImportReplacements = Record<string, string>;

export const materializeUsersImportFile = async (
  templatePath: string,
  replacements: UsersImportReplacements,
) => {
  const template = await readFile(templatePath, "utf8");

  const contents = Object.entries(replacements).reduce((result, [token, value]) => {
    return result.replaceAll(`__${token}__`, value);
  }, template);

  if (/__[A-Z0-9_]+__/.test(contents)) {
    throw new Error(`Unresolved users import template token in ${templatePath}`);
  }

  const directory = await mkdtemp(join(tmpdir(), "mentingo-users-import-"));
  const filePath = join(directory, basename(templatePath));

  await writeFile(filePath, contents, "utf8");

  return {
    filePath,
    cleanup: async () => {
      await rm(directory, { recursive: true, force: true });
    },
  };
};
