import { expect, test } from "@playwright/test";

import { expectLearningPathAccessFlow } from "../flows/learning-paths/expect-learning-path-access.flow";

for (const label of ["Start path", "Continue path"]) {
  test(`enrollment access accepts ${label} with seeded progress`, async ({ page }) => {
    await page.setContent(`<article data-testid="learning-path-item-sales-onboarding">
      <a data-testid="learning-path-card-continue-button" href="/course/sales-basics">${label}</a>
    </article>`);
    const link = await expectLearningPathAccessFlow(page, "sales-onboarding");
    await expect(link).toHaveText(label);
  });
}

test("a visible link on another path cannot prove access to the assigned path", async ({
  page,
}) => {
  await page.setContent(`<article data-testid="learning-path-item-other-path">
    <a data-testid="learning-path-card-continue-button" href="/course/sales-basics">Continue path</a>
  </article>`);
  await expect(expectLearningPathAccessFlow(page, "sales-onboarding")).rejects.toThrow();
});

test("a label without a course destination cannot prove access", async ({ page }) => {
  await page.setContent(`<article data-testid="learning-path-item-sales-onboarding">
    <a data-testid="learning-path-card-continue-button" href="/auth/login">Start path</a>
  </article>`);
  await expect(expectLearningPathAccessFlow(page, "sales-onboarding")).rejects.toThrow();
});
