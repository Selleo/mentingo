import { join } from "node:path";

const webRoot = process.cwd().endsWith("apps/web")
  ? process.cwd()
  : join(process.cwd(), "apps/web");
const fixturePath = (filename: string) => join(webRoot, "e2e/data/scorm/files", filename);

export const SCORM_TEST_DATA = {
  files: {
    singleScoPackage: fixturePath("single-scorm.zip"),
    multiScoPackage: fixturePath("multi-scorm.zip"),
    invalidPackage: fixturePath("invalid-scorm.zip"),
  },
} as const;
