import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { WCAG_LEVEL_TAGS, type WcagLevel } from "../../utils/wcag-level-tags";

const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";

type AssertNoAxeViolationsOptions = {
  disabledRules?: string[];
  level?: WcagLevel;
};

/**
 * Scans the current page with axe at the given WCAG level, one report line per violating node.
 * Callers wait until the page content has loaded.
 */
export const assertNoAxeViolationsFlow = async (
  page: Page,
  { disabledRules = [], level = DEFAULT_WCAG_LEVEL }: AssertNoAxeViolationsOptions = {},
) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_LEVEL_TAGS[level])
    .disableRules(disabledRules)
    .analyze();

  const report = violations.flatMap(({ id, impact, help, nodes }) =>
    nodes.map(
      ({ target, html }) =>
        `${id} (${impact}) ${target.flat().join(" >>> ")}: ${help} | ${html.slice(0, 200)}`,
    ),
  );

  // Soft, so one run lists the violations of every scanned page.
  expect.soft(report, `axe WCAG ${level} violations on ${page.url()}`).toEqual([]);
};
