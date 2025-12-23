import { eq } from "drizzle-orm";

import { baseArticleTitle } from "src/articles/constants";
import { ArticlesRepository } from "src/articles/repositories/articles.repository";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { articles } from "src/storage/schema";
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
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

describe("ArticlesRepository (unit)", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let repository: ArticlesRepository;
  let userFactory: ReturnType<typeof createUserFactory>;
  let articleFactory: ReturnType<typeof createArticleFactory>;
  let sectionFactory: ReturnType<typeof createArticleSectionFactory>;

  beforeAll(async () => {
    testContext = await createUnitTest();
    repository = testContext.module.get(ArticlesRepository);
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

  describe("sections", () => {
    it("creates and updates a section", async () => {
      const [created] = await repository.createArticleSection("en", buildJsonbField("en", "Intro"));

      expect(created).toBeDefined();
      expect(created.title).toBe("Intro");

      const [updated] = await repository.updateArticleSectionTitle(created.id, "en", "Updated");

      expect(updated).toBeDefined();
      expect(updated.title).toBe("Updated");
    });

    it("adds and removes a language", async () => {
      const section = await sectionFactory.create({ title: "Section" });

      const [added] = await repository.addLanguageToSection(
        section.id,
        "pl",
        section.availableLocales as SupportedLanguages[],
        "Sekcja",
      );

      expect(added.title).toBe("Sekcja");

      const [removed] = await repository.removeLanguageFromSection(section.id, "pl", ["en"]);

      expect(removed.availableLocales).toEqual(["en"]);
    });

    it("returns section details with assigned article count", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Public" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        isPublic: true,
      });
      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        isPublic: false,
      });

      const [details] = await repository.getArticleSectionDetails(section.id, "en");

      expect(details.assignedArticlesCount).toBe(1);
      expect(details.title).toBe("Public");
    });
  });

  describe("articles", () => {
    it("creates and updates an article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Updates" });

      const [created] = await repository.createArticle(
        "en",
        buildJsonbField("en", "Original"),
        author.id,
        section.id,
      );

      expect(created.title).toBe("Original");

      const [updated] = await repository.updateArticle(
        created.id,
        "en",
        { title: setJsonbField(articles.title, "en", "New") },
        author.id,
      );

      expect(updated.title).toBe("New");
    });

    it("counts public articles in a section", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Counts" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        isPublic: true,
      });
      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        isPublic: false,
      });

      const count = await repository.countArticlesInSection(section.id);

      expect(count).toBe(1);
    });

    it("returns articles ordered by publish date", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Order" });

      const older = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Older",
        publishedAt: "2024-01-01T00:00:00.000Z",
      });

      const newer = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Newer",
        publishedAt: "2024-01-02T00:00:00.000Z",
      });

      const results = await repository.getArticles("en", [
        eq(articles.articleSectionId, section.id),
      ]);

      expect(results[0].id).toBe(newer.id);
      expect(results[1].id).toBe(older.id);
      expect(results[0].authorName).toContain(author.firstName);
    });

    it("returns draft articles", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Drafts" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
        publishedAt: null,
      });

      await db
        .update(articles)
        .set({ archived: true })
        .where(eq(articles.articleSectionId, section.id));

      const drafts = await repository.getDraftArticles("en");

      expect(drafts).toHaveLength(0);

      await db
        .update(articles)
        .set({ archived: false, publishedAt: null })
        .where(eq(articles.articleSectionId, section.id));

      const refreshedDrafts = await repository.getDraftArticles("en");

      expect(refreshedDrafts.length).toBeGreaterThanOrEqual(1);
    });

    it("deletes a language from an article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Languages" });

      const article = await createArticleWithLocales(db, {
        articleSectionId: section.id,
        authorId: author.id,
        baseLanguage: "en",
        locales: ["en", "pl"],
        titles: { en: "English", pl: "Polski" },
      });

      const [updated] = await repository.deleteArticleLanguage(article.id, "pl", ["en"]);

      expect(updated.availableLocales).toEqual(["en"]);

      const [fetched] = await repository.getArticleById(article.id);
      expect(fetched.availableLocales).toEqual(["en"]);
      expect(fetched.title).toHaveProperty("en");
      expect(fetched.title).not.toHaveProperty("pl");
    });

    it("archives an article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Archive" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
      });

      await repository.archiveArticle(article.id, author.id);

      const [updated] = await repository.getArticleById(article.id);
      expect(updated.archived).toBe(true);
      expect(updated.isPublic).toBe(false);
    });

    it("returns article with access info", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Access" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Accessible",
      });

      const [result] = await repository.getArticleWithAccess(article.id, "en", [
        eq(articles.isPublic, true),
      ]);

      expect(result.id).toBe(article.id);
      expect(result.title).toBe("Accessible");
    });

    it("returns adjacent article ids", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Adjacent" });

      const first = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        publishedAt: "2024-01-01T00:00:00.000Z",
      });

      const middle = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        publishedAt: "2024-01-02T00:00:00.000Z",
      });

      const last = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        publishedAt: "2024-01-03T00:00:00.000Z",
      });

      const adjacent = await repository.getAdjacentArticleIds(
        "2024-01-02T00:00:00.000Z",
        [eq(articles.articleSectionId, section.id)],
        articles.publishedAt,
      );

      expect(adjacent.previousArticle).toBe(first.id);
      expect(adjacent.nextArticle).toBe(last.id);
      expect(middle.id).toBeDefined();
    });

    it("returns sections with article items", async () => {
      const author = await userFactory.create();
      const sectionA = await sectionFactory.create({ title: "Alpha" });
      const sectionB = await sectionFactory.create({ title: "Beta" });

      await articleFactory.create({
        articleSectionId: sectionA.id,
        authorId: author.id,
        title: "Article A",
      });
      await articleFactory.create({
        articleSectionId: sectionB.id,
        authorId: author.id,
        title: "Article B",
      });

      const currentUser: CurrentUser = {
        userId: author.id,
        email: author.email,
        role: USER_ROLES.ADMIN,
      };

      const sections = await repository.getArticleSections(
        "en",
        [eq(articles.isPublic, true)],
        currentUser,
      );

      expect(sections).toHaveLength(2);
      expect(sections[0].articles.length).toBeGreaterThanOrEqual(1);
    });

    it("creates a new language entry for an article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Languages" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
      });

      const [created] = await repository.createArticleLanguage(
        article.id,
        "pl",
        article.availableLocales as SupportedLanguages[],
      );

      expect(created.title).toBe(baseArticleTitle.pl);
    });
  });
});
