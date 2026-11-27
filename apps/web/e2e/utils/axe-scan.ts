import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { WCAG_LEVEL_TAGS, type WcagLevel } from "./wcag-level-tags";

export type AxeScanResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
export type AxeRuleResult = AxeScanResults["violations"][number];

export type AxeScanOptions = {
  tags: string[];
  disabledRules?: string[];
  /** CSS selectors of elements left out of the scan, for every rule. */
  exclude?: string[];
};

export type AxeRegressionCheckOptions = {
  level?: WcagLevel;
  disabledRules?: string[];
};

const DEFAULT_WCAG_LEVEL: WcagLevel = "AA";

/**
 * The one axe scan shared by the E2E accessibility specs and the WCAG audit.
 * Callers MUST wait for the page content first; this does not wait for anything.
 */
export const scanPageWithAxe = async (
  page: Page,
  { tags, disabledRules = [], exclude = [] }: AxeScanOptions,
): Promise<AxeScanResults> => {
  const axeBuilder = new AxeBuilder({ page }).withTags(tags).disableRules(disabledRules);
  exclude.forEach((selector) => axeBuilder.exclude(selector));
  const results = await axeBuilder.analyze();

  expect(results.passes.length, `axe checked nothing on ${page.url()}`).toBeGreaterThan(0);

  return results;
};

/** One report line per violating node. */
export const formatAxeViolations = (violations: AxeRuleResult[]) =>
  violations.flatMap(({ id, impact, help, nodes }) =>
    nodes.map(
      ({ target, html }) =>
        `${id} (${impact ?? "unknown"}) ${target.flat().join(" >>> ")}: ${help} | ${html.slice(0, 200)}`,
    ),
  );

/**
 * Regression check on an existing scan: no violation of a rule tagged for the WCAG level may
 * remain. Soft, so one run reports every scanned page; the test fails when it ends.
 */
export const expectNoAxeViolations = (
  page: Page,
  results: AxeScanResults,
  { level = DEFAULT_WCAG_LEVEL, disabledRules = [] }: AxeRegressionCheckOptions = {},
) => {
  const levelTags = new Set(WCAG_LEVEL_TAGS[level]);
  const violations = results.violations.filter(
    ({ id, tags }) => !disabledRules.includes(id) && tags.some((tag) => levelTags.has(tag)),
  );

  expect
    .soft(formatAxeViolations(violations), `axe WCAG ${level} violations on ${page.url()}`)
    .toEqual([]);
};

/** Attaches the results axe could not decide (`incomplete`) to the test; they never fail it. */
export const attachAxeIncomplete = async (page: Page, results: AxeScanResults) => {
  if (!results.incomplete.length) return;

  const url = page.url();
  test.info().annotations.push({
    type: "axe-incomplete",
    description: `${url}: ${results.incomplete.map(({ id }) => id).join(", ")}`,
  });
  await test.info().attach(`axe-incomplete ${url}`, {
    body: JSON.stringify(results.incomplete, null, 2),
    contentType: "application/json",
  });
};
