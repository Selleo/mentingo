import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/** Reads a fixture file into a `File` the generated API client can upload. */
export const readFixtureFile = async (filePath: string, type: string) => {
  const contents = await readFile(filePath);

  return new File([new Uint8Array(contents)], basename(filePath), { type });
};
