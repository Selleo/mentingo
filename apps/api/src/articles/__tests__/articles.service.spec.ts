import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ARTICLE_STATUS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { ArticlesService } from "src/articles/services/articles.service";
import { articles, articleSections } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createUnitTest } from "../../../test/create-unit-test";
import {
  createArticleFactory,
  createArticleSectionFactory,
  createArticleWithLocales,
} from "../../../test/factory/article.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { DatabasePg } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

describe("ArticlesService (unit)", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let service: ArticlesService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let articleFactory: ReturnType<typeof createArticleFactory>;
  let sectionFactory: ReturnType<typeof createArticleSectionFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    await testContext.module.init();
    service = testContext.module.get(ArticlesService);
    db = testContext.db;
    userFactory = createUserFactory(db);
    articleFactory = createArticleFactory(db);
    sectionFactory = createArticleSectionFactory(db);
  }, 30000);

  afterEach(async () => {
    await truncateTables(db, [
      "articles",
      "article_sections",
      "credentials",
      "user_onboarding",
      "users",
    ]);
  });

  afterAll(async () => {
    await testContext.teardown();
  });

  const createAdminUser = async (): Promise<CurrentUser> => {
    const admin = await userFactory.create();
    return { userId: admin.id, email: admin.email, role: USER_ROLES.ADMIN };
  };

  describe("sections", () => {
    it("creates a section", async () => {
      const currentUser = await createAdminUser();
      const section = await service.createArticleSection({ language: "en" }, currentUser);

      expect(section.title).toBeDefined();
    });

    it("returns section details", async () => {
      const section = await sectionFactory.create({ title: "Details" });

      const details = await service.getArticleSection(section.id, "en");

      expect(details.id).toBe(section.id);
      expect(details.title).toBe("Details");
    });

    it("throws when section is missing", async () => {
      await expect(
        service.getArticleSection("00000000-0000-0000-0000-000000000000", "en"),
      ).rejects.toThrow(NotFoundException);
    });

    it("adds a new language to section", async () => {
      const section = await sectionFactory.create({ title: "Lang" });

      const currentUser = await createAdminUser();

      const created = await service.createArticleSectionLanguage(
        section.id,
        { language: "pl" },
        currentUser,
      );

      expect(created.title).toBeDefined();
    });

    it("rejects deleting base language", async () => {
      const section = await sectionFactory.create({ title: "Base" });
      const currentUser = await createAdminUser();

      await expect(
        service.deleteArticleSectionLanguage(section.id, "en", currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("deletes empty section", async () => {
      const section = await sectionFactory.create({ title: "Delete" });
      const currentUser = await createAdminUser();

      await service.deleteArticleSection(section.id, currentUser);

      const [found] = await db
        .select({ id: articleSections.id })
        .from(articleSections)
        .where(eq(articleSections.id, section.id));

      expect(found).toBeUndefined();
    });

    it("rejects deleting section with articles", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "HasArticles" });
      const currentUser = await createAdminUser();

      await articleFactory.create({ articleSectionId: section.id, authorId: author.id });

      await expect(service.deleteArticleSection(section.id, currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("articles", () => {
    it("creates an article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Articles" });

      const article = await service.createArticle(
        { language: "en", sectionId: section.id },
        {
          userId: author.id,
          email: author.email,
          role: USER_ROLES.ADMIN,
        },
      );

      expect(article.title).toBeDefined();
    });

    it("updates article and sets publishedAt when published", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Update" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
      });

      const currentUser: CurrentUser = {
        userId: author.id,
        email: author.email,
        role: USER_ROLES.ADMIN,
      };

      await service.updateArticle(
        article.id,
        { language: "en", status: ARTICLE_STATUS.PUBLISHED, title: "Published" },
        currentUser,
      );

      const [updated] = await db.select().from(articles).where(eq(articles.id, article.id));

      expect(updated.status).toBe(ARTICLE_STATUS.PUBLISHED);
      expect(updated.publishedAt).not.toBeNull();
    });

    it("deletes article language", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Locales" });
      const article = await createArticleWithLocales(db, {
        articleSectionId: section.id,
        authorId: author.id,
        baseLanguage: "en",
        locales: ["en", "pl"],
        titles: { en: "English", pl: "Polski" },
      });

      const currentUser: CurrentUser = {
        userId: author.id,
        email: author.email,
        role: USER_ROLES.ADMIN,
      };

      const updated = await service.deleteArticleLanguage(article.id, "pl", currentUser);

      expect(updated.availableLocales).toEqual(["en"]);
    });

    it("rejects deleting base language", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "BaseLang" });
      const article = await createArticleWithLocales(db, {
        articleSectionId: section.id,
        authorId: author.id,
        baseLanguage: "en",
        locales: ["en", "pl"],
        titles: { en: "English", pl: "Polski" },
      });

      const currentUser: CurrentUser = {
        userId: author.id,
        email: author.email,
        role: USER_ROLES.ADMIN,
      };

      await expect(service.deleteArticleLanguage(article.id, "en", currentUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("returns article for public access", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Public" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        content: "<p>hello</p>",
      });

      const result = await service.getArticle(article.id, "en");

      expect(result.id).toBe(article.id);
      expect(result.content).toContain("hello");
    });

    it("blocks draft access for non-admin", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Draft" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
      });

      await expect(service.getArticle(article.id, "en", true)).rejects.toThrow(NotFoundException);
    });

    it("generates preview content", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Preview" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
      });

      const preview = await service.generateArticlePreview(article.id, "en", "<p>Preview</p>");

      expect(preview).toContain("Preview");
    });
  });
});
