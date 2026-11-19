import { USER_ROLE } from "~/config/userRoles";

import { NEWS_DETAILS_PAGE_HANDLES, NEWS_PAGE_HANDLES } from "../../data/news/handles";
import { NewsFactory } from "../../factories/news.factory";
import { openNewsDetailsFromListFlow } from "../../flows/news/open-news-details-from-list.flow";
import { openNewsPageFlow } from "../../flows/news/open-news-page.flow";
import { overrideContentModuleState } from "../../utils/content-features";

import { expect, test } from "./news.fixture";

const ROLES = [
  { role: USER_ROLE.admin, canManage: true },
  { role: USER_ROLE.contentCreator, canManage: false },
  { role: USER_ROLE.student, canManage: false },
] as const;

for (const { role, canManage } of ROLES) {
  test(`${role} can browse news and open details`, async ({
    cleanup,
    withWorkerPage,
    workerTenantApiClient,
  }) => {
    const newsFactory = new NewsFactory(workerTenantApiClient);
    const prefix = `news-access-${role}-${Date.now()}`;
    const news = await newsFactory.create({
      title: `${prefix}-first`,
      summary: `${prefix}-summary`,
      status: "published",
      isPublic: true,
    });
    cleanup.add(() => newsFactory.safeDelete(news.id));
    const otherNews = await newsFactory.create({
      title: `${prefix}-second`,
      status: "published",
      isPublic: true,
    });
    cleanup.add(() => newsFactory.safeDelete(otherNews.id));

    await withWorkerPage(role, async ({ page }) => {
      await openNewsPageFlow(page);
      await expect(page.getByTestId(NEWS_PAGE_HANDLES.HEADING)).toBeVisible();
      await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(news.id))).toBeVisible();
      await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(otherNews.id))).toBeVisible();

      await openNewsDetailsFromListFlow(page, news.id);

      await expect(page).toHaveURL(new RegExp(`/news/${news.id}$`));
      await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(news.title);
      await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.SUMMARY)).toHaveText(
        `${prefix}-summary`,
      );
      await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.EDIT_BUTTON)).toHaveCount(
        canManage ? 1 : 0,
      );
      await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.DELETE_BUTTON)).toHaveCount(
        canManage ? 1 : 0,
      );
    });
  });
}

test("visitor sees only public news when public news access is enabled", async ({
  cleanup,
  createWorkspacePage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await overrideContentModuleState(workerTenantApiClient, "news", {
      enabled: true,
      public: true,
    }),
  );
  const newsFactory = new NewsFactory(workerTenantApiClient);
  const publicNews = await newsFactory.create({
    title: `news-public-${Date.now()}`,
    status: "published",
    isPublic: true,
  });
  cleanup.add(() => newsFactory.safeDelete(publicNews.id));
  const privateNews = await newsFactory.create({
    title: `news-private-${Date.now()}`,
    status: "published",
    isPublic: false,
  });
  cleanup.add(() => newsFactory.safeDelete(privateNews.id));
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openNewsPageFlow(page);
  await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(publicNews.id))).toBeVisible();
  await expect(page.getByTestId(NEWS_PAGE_HANDLES.item(privateNews.id))).toHaveCount(0);

  await openNewsDetailsFromListFlow(page, publicNews.id);
  await expect(page).toHaveURL(new RegExp(`/news/${publicNews.id}$`));
  await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveText(publicNews.title);

  await page.goto(`/news/${privateNews.id}`);
  await expect(page).not.toHaveURL(/\/auth\/login$/);
  await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.NOT_FOUND)).toBeVisible();
  await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.TITLE)).toHaveCount(0);
});
