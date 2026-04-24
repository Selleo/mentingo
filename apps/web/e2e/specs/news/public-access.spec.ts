import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES, NEWS_PAGE_HANDLES } from "../../data/news/handles";
import { openNewsPageFlow } from "../../flows/news/open-news-page.flow";
import { ensureContentFeaturesEnabled } from "../../utils/content-features";

import { expect, test } from "./news-test.fixture";

test("visitor can access published news list and details when public news access is enabled", async ({
  cleanup,
  factories,
  apiClient,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const restoreContentFeatures = await ensureContentFeaturesEnabled(apiClient, {
      publicNews: true,
    });

    cleanup.add(restoreContentFeatures);

    const newsFactory = factories.createNewsFactory();
    const news = await newsFactory.create({
      title: `news-public-${Date.now()}`,
      summary: `news-public-summary-${Date.now()}`,
      status: "published",
      isPublic: true,
    });

    cleanup.add(async () => {
      const existingNews = await newsFactory.safeGetById(news.id);

      if (existingNews) {
        await newsFactory.delete(news.id);
      }
    });

    const browser = page.context().browser();

    if (!browser) {
      throw new Error("Expected browser instance for public context");
    }

    await page.goto("/");
    const publicContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const publicPage = await publicContext.newPage();

    try {
      await openNewsPageFlow(publicPage);
      await expect(publicPage.getByTestId(NEWS_PAGE_HANDLES.item(news.id))).toBeVisible();

      await publicPage.getByTestId(NEWS_PAGE_HANDLES.item(news.id)).click();
      await expect(publicPage).toHaveURL(new RegExp(`/news/${news.id}$`));
      await expect(publicPage.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(news.title);
    } finally {
      await publicContext.close();
    }
  });
});

test("visitor cannot see private news when public news access is enabled", async ({
  cleanup,
  factories,
  apiClient,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const restoreContentFeatures = await ensureContentFeaturesEnabled(apiClient, {
      publicNews: true,
    });

    cleanup.add(restoreContentFeatures);

    const newsFactory = factories.createNewsFactory();
    const news = await newsFactory.create({
      title: `news-private-${Date.now()}`,
      summary: `news-private-summary-${Date.now()}`,
      status: "published",
      isPublic: false,
    });

    cleanup.add(async () => {
      const existingNews = await newsFactory.safeGetById(news.id);

      if (existingNews) {
        await newsFactory.delete(news.id);
      }
    });

    const browser = page.context().browser();

    if (!browser) {
      throw new Error("Expected browser instance for public context");
    }

    await page.goto("/");
    const publicContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const publicPage = await publicContext.newPage();

    try {
      await openNewsPageFlow(publicPage);
      await expect(publicPage.getByTestId(NEWS_PAGE_HANDLES.item(news.id))).toHaveCount(0);

      await publicPage.goto(`/news/${news.id}`);
      await expect(publicPage).not.toHaveURL(/\/auth\/login$/);
      await expect(publicPage.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveCount(0);
    } finally {
      await publicContext.close();
    }
  });
});
