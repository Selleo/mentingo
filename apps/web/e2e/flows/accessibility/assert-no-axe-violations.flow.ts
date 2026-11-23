import { attachAxeIncomplete, expectNoAxeViolations, scanPageWithAxe } from "../../utils/axe-scan";
import { WCAG_LEVEL_TAGS, type WcagLevel } from "../../utils/wcag-level-tags";

import type { Page } from "@playwright/test";

const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";

type AssertNoAxeViolationsOptions = {
  disabledRules?: string[];
  /** CSS selectors of elements left out of the scan, for every rule. */
  exclude?: string[];
  level?: WcagLevel;
};

/**
 * Scans the current page with axe at the given WCAG level, one report line per violating node.
 * Callers MUST wait for the page content first; this flow does not wait for anything.
 * Violations are a soft check: they are all reported when the test ends, so one run lists every
 * scanned page. Results axe could not decide (`incomplete`) are attached to the test, not failed.
 */
export const assertNoAxeViolationsFlow = async (
  page: Page,
  {
    disabledRules = [],
    exclude = [],
    level = DEFAULT_WCAG_LEVEL,
  }: AssertNoAxeViolationsOptions = {},
) => {
  const results = await scanPageWithAxe(page, {
    tags: WCAG_LEVEL_TAGS[level],
    disabledRules,
    exclude,
  });

  await attachAxeIncomplete(page, results);
  expectNoAxeViolations(page, results, { level });
};
