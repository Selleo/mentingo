import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { describe, expect, it } from "vitest";

const backendErrors = readFileSync(
  resolve(process.cwd(), "../api/src/report/constants/reports.errors.ts"),
  "utf8",
);
const errorKeys = [...backendErrors.matchAll(/"reports\.errors\.([^"]+)"/g)].map(([, key]) => key);

describe("report API error translations", () => {
  it.each(Object.values(SUPPORTED_LANGUAGES))(
    "translates every backend error in %s",
    (language) => {
      const translations = JSON.parse(
        readFileSync(resolve(process.cwd(), `app/locales/${language}/translation.json`), "utf8"),
      ) as { reports: { errors: Record<string, string> } };

      expect(errorKeys.length).toBeGreaterThan(0);
      for (const key of errorKeys) {
        expect(translations.reports.errors[key], key).toEqual(expect.any(String));
        expect(translations.reports.errors[key].trim(), key).not.toBe("");
      }
    },
  );
});
