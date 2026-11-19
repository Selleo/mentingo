import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { WCAG_LEVEL_TAGS, type WcagLevel } from "../../utils/wcag-level-tags";

const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";

type AssertNoAxeViolationsOptions = {
  disabledRules?: string[];
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
  { disabledRules = [], level = DEFAULT_WCAG_LEVEL }: AssertNoAxeViolationsOptions = {},
) => {
  const { incomplete, passes, violations } = await new AxeBuilder({ page })
    .withTags(WCAG_LEVEL_TAGS[level])
    .disableRules(disabledRules)
    .analyze();
  const url = page.url();

  expect(passes.length, `axe checked nothing on ${url}`).toBeGreaterThan(0);

  if (incomplete.length) {
    test.info().annotations.push({
      type: "axe-incomplete",
      description: `${url}: ${incomplete.map(({ id }) => id).join(", ")}`,
    });
    await test.info().attach(`axe-incomplete ${url}`, {
      body: JSON.stringify(incomplete, null, 2),
      contentType: "application/json",
    });
  }

  const report = violations.flatMap(({ id, impact, help, nodes }) =>
    nodes.map(
      ({ target, html }) =>
        `${id} (${impact ?? "unknown"}) ${target.flat().join(" >>> ")}: ${help} | ${html.slice(0, 200)}`,
    ),
  );

  expect.soft(report, `axe WCAG ${level} violations on ${url}`).toEqual([]);
};
