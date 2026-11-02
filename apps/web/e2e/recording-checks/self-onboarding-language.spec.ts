import { expect, test } from "@playwright/test";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import {
  getSelfOnboardingLanguage,
  recordingText,
  recordingValue,
} from "../utils/self-onboarding-context";

/** Run in separate EN/PL processes, matching actual localized scenario replay. */
test("native control selectors and example data agree with the recording language", async ({
  page,
}) => {
  const language = getSelfOnboardingLanguage();
  const polish = language === SUPPORTED_LANGUAGES.PL;
  const save = recordingText("common.button.save");
  expect(save).toBe(polish ? "Zapisz" : "Save");
  const title = recordingValue({ en: "Customer support journey", pl: "Ścieżka obsługi klienta" });
  await page.setContent(
    `<html lang="${language}"><input aria-label="title"/><button>${save}</button></html>`,
  );
  await page.getByLabel("title", { exact: true }).fill(title);
  await page.getByRole("button", { name: save, exact: true }).click();
  await expect(page.getByLabel("title", { exact: true })).toHaveValue(
    polish ? "Ścieżka obsługi klienta" : "Customer support journey",
  );
});

test("missing native translation keys fail visibly instead of using an English fallback", () => {
  expect(() => recordingText("selfOnboarding.doesNotExist")).toThrow(
    "Missing recording UI translation",
  );
});
