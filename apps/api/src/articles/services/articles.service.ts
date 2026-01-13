import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { ARTICLE_STATUS, type SupportedLanguages } from "@repo/shared";
import { load as loadHtml } from "cheerio";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { isEmpty, isEqual } from "lodash";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import {
  CreateArticleEvent,
  CreateArticleSectionEvent,
  DeleteArticleEvent,
  DeleteArticleSectionEvent,
  UpdateArticleEvent,
  UpdateArticleSectionEvent,
} from "src/events";
import {
  ENTITY_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
  RESOURCE_CATEGORIES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { SettingsService } from "src/settings/settings.service";
import { articles, articleSections } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { baseArticleSectionTitle, baseArticleTitle } from "../constants";
import { ArticlesRepository } from "../repositories/articles.repository";

import type { GetArticleSectionResponse } from "../schemas/articleSection.schema";
import type { GetArticleTocResponse } from "../schemas/articleToc.schema";
import type {
  CreateArticle,
  CreateArticleSection,
  CreateLanguageArticle,
} from "../schemas/createArticle.schema";
import type { ArticleResource, ArticleResources } from "../schemas/selectArticle.schema";
import type { UpdateArticle, UpdateArticleSection } from "../schemas/updateArticle.schema";
import type { InferSelectModel } from "drizzle-orm";
import type {
  ArticleActivityLogSnapshot,
  ArticleSectionActivityLogSnapshot,
} from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type StoredArticleResource = Awaited<ReturnType<FileService["getResourcesForEntity"]>>[number];
type ResourceMetadata = StoredArticleResource["metadata"] & { originalFilename?: unknown };

@Injectable()
export class ArticlesService {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly eventBus: EventBus,
    private readonly settingsService: SettingsService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async createArticleSection(
    createArticleSectionBody: CreateArticleSection,
    currentUser: CurrentUser,
  ) {
    await this.checkAccess(currentUser.userId);

    const { language } = createArticleSectionBody;

    const [section] = await this.articlesRepository.createArticleSection(
      language,
      buildJsonbField(language, baseArticleSectionTitle[language]),
    );

    if (!section) throw new BadRequestException("adminArticleView.toast.createSectionError");

    const createdSectionSnapshot = await this.buildArticleSectionActivitySnapshot(
      section.id,
      language,
    );

    this.eventBus.publish(
      new CreateArticleSectionEvent({
        articleSectionId: section.id,
        actor: currentUser,
        createdArticleSection: createdSectionSnapshot,
        language,
      }),
    );

    return section;
  }

  async getArticleSection(
    sectionId: UUIDType,
    requestedLanguage: SupportedLanguages,
    currentUser: CurrentUser,
  ): Promise<GetArticleSectionResponse> {
    await this.checkAccess(currentUser.userId);

    const [section] = await this.articlesRepository.getArticleSectionDetails(
      sectionId,
      requestedLanguage,
    );

    if (!section) throw new NotFoundException("adminArticleView.toast.notFoundError");

    return section;
  }

  async updateArticleSection(
    sectionId: UUIDType,
    updateArticleSectionBody: UpdateArticleSection,
    currentUser: CurrentUser,
  ) {
    await this.checkAccess(currentUser.userId);

    const { language, title } = updateArticleSectionBody;

    await this.validateArticleSectionExists(sectionId, language);

    const previousSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    const [updatedSection] = await this.articlesRepository.updateArticleSectionTitle(
      sectionId,
      language,
      title ?? "",
    );

    if (!updatedSection) throw new BadRequestException("adminArticleView.toast.updateError");

    const updatedSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    if (!this.areSectionSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleSectionEvent({
          articleSectionId: sectionId,
          actor: currentUser,
          previousArticleSectionData: previousSnapshot,
          updatedArticleSectionData: updatedSnapshot,
          language,
          action: "update",
        }),
      );
    }

    return updatedSection;
  }

  async createArticleSectionLanguage(
    sectionId: UUIDType,
    body: CreateArticleSection,
    currentUser: CurrentUser,
  ) {
    await this.checkAccess(currentUser.userId);

    const { language } = body;

    const existingSection = await this.validateArticleSectionExists(sectionId, language, false);

    const previousSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    if (existingSection.availableLocales.includes(language))
      throw new BadRequestException("adminArticleView.toast.languageAlreadyExists");

    const [createdLanguage] = await this.articlesRepository.addLanguageToSection(
      sectionId,
      language,
      existingSection.availableLocales,
      baseArticleSectionTitle[language],
    );

    if (!createdLanguage)
      throw new BadRequestException("adminArticleView.toast.createLanguageError");

    const updatedSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    if (!this.areSectionSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleSectionEvent({
          articleSectionId: sectionId,
          actor: currentUser,
          previousArticleSectionData: previousSnapshot,
          updatedArticleSectionData: updatedSnapshot,
          language,
          action: "add_language",
        }),
      );
    }

    return createdLanguage;
  }

  async deleteArticleSectionLanguage(
    sectionId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ) {
    await this.checkAccess(currentUser.userId);

    const existingSection = await this.validateArticleSectionExists(sectionId, language);

    const previousSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    if (existingSection.availableLocales.length <= 1)
      throw new BadRequestException("adminArticleView.toast.minimumLanguageError");

    if (existingSection.baseLanguage === language)
      throw new BadRequestException("adminArticleView.toast.cannotRemoveBaseLanguage");

    const updatedLocales = existingSection.availableLocales.filter((locale) => locale !== language);

    const [updatedSection] = await this.articlesRepository.removeLanguageFromSection(
      sectionId,
      language,
      updatedLocales,
    );

    if (!updatedSection)
      throw new BadRequestException("adminArticleView.toast.removeLanguageError");

    const updatedSnapshot = await this.buildArticleSectionActivitySnapshot(sectionId, language);

    if (!this.areSectionSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleSectionEvent({
          articleSectionId: sectionId,
          actor: currentUser,
          previousArticleSectionData: previousSnapshot,
          updatedArticleSectionData: updatedSnapshot,
          language,
          action: "remove_language",
        }),
      );
    }

    return updatedSection;
  }

  async deleteArticleSection(sectionId: UUIDType, currentUser: CurrentUser) {
    await this.checkAccess(currentUser.userId);

    const existingSection = await this.validateArticleSectionExists(sectionId, undefined, false);

    const assignedArticlesCount = await this.articlesRepository.countArticlesInSection(sectionId);

    if (assignedArticlesCount > 0)
      throw new BadRequestException("adminArticleView.toast.sectionHasAssignedArticles");

    const [deletedSection] = await this.articlesRepository.deleteSection(sectionId);

    if (!deletedSection) throw new BadRequestException("adminArticleView.toast.deleteSectionError");

    this.eventBus.publish(
      new DeleteArticleSectionEvent({
        articleSectionId: sectionId,
        actor: currentUser,
        baseLanguage: existingSection.baseLanguage,
        availableLocales: existingSection.availableLocales,
        title: this.extractTitleByLanguage(existingSection.title, existingSection.baseLanguage),
      }),
    );
  }

  async createArticle(createArticleBody: CreateArticle, currentUser: CurrentUser) {
    await this.checkAccess(currentUser.userId);

    const { language, sectionId } = createArticleBody;

    await this.validateArticleSectionExists(sectionId, undefined, false);

    const [createdArticle] = await this.articlesRepository.createArticle(
      language,
      buildJsonbField(language, baseArticleTitle[language]),
      currentUser.userId,
      sectionId,
    );

    if (!createdArticle) throw new BadRequestException("adminArticleView.toast.createError");

    const createdArticleSnapshot = await this.buildArticleActivitySnapshot(
      createdArticle.id,
      language,
    );

    this.eventBus.publish(
      new CreateArticleEvent({
        articleId: createdArticle.id,
        actor: currentUser,
        createdArticle: createdArticleSnapshot,
        language,
      }),
    );

    return createdArticle;
  }

  async updateArticle(
    articleId: UUIDType,
    updateArticleBody: UpdateArticle,
    currentUser?: CurrentUser,
    coverFile?: Express.Multer.File,
  ) {
    await this.checkAccess(currentUser?.userId);

    await this.checkEditAccess(articleId, currentUser);

    const { language, ...updateArticleData } = updateArticleBody;

    const existingArticle = await this.validateArticleExists(articleId, language);

    const previousSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    const finalUpdateData = this.buildUpdateData(existingArticle, updateArticleData, language);

    if (coverFile) {
      await this.uploadCoverImageToArticle(
        articleId,
        coverFile,
        language,
        coverFile.originalname,
        "",
        currentUser,
      );
    }

    const [updatedArticle] = await this.articlesRepository.updateArticle(
      articleId,
      language,
      finalUpdateData,
      currentUser?.userId ?? null,
    );

    if (!updatedArticle) throw new BadRequestException("adminArticleView.toast.updateError");

    const updatedSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (currentUser && !this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleEvent({
          articleId,
          actor: currentUser,
          previousArticleData: previousSnapshot,
          updatedArticleData: updatedSnapshot,
          language,
          action: "update",
        }),
      );
    }

    return updatedArticle;
  }

  async getArticles(
    requestedLanguage: SupportedLanguages,
    currentUser?: CurrentUser,
    searchQuery?: string,
  ) {
    await this.checkAccess(currentUser?.userId);

    const conditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      currentUser,
    );

    return this.articlesRepository.getArticles(requestedLanguage, conditions, searchQuery);
  }

  async getDraftArticles(requestedLanguage: SupportedLanguages) {
    return this.articlesRepository.getDraftArticles(requestedLanguage);
  }

  async deleteArticleLanguage(
    articleId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ) {
    await this.checkAccess(currentUser.userId);
    await this.checkEditAccess(articleId, currentUser);

    const existingArticle = await this.validateArticleExists(articleId, language);

    const previousSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (existingArticle.availableLocales.length <= 1)
      throw new BadRequestException("adminArticleView.toast.minimumLanguageError");

    if (existingArticle.baseLanguage === language)
      throw new BadRequestException("adminArticleView.toast.cannotRemoveBaseLanguage");

    const updatedLocales = existingArticle.availableLocales.filter((locale) => locale !== language);

    const [updatedArticle] = await this.articlesRepository.deleteArticleLanguage(
      articleId,
      language,
      updatedLocales,
    );

    if (!updatedArticle)
      throw new BadRequestException("adminArticleView.toast.removeLanguageError");

    const updatedSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (!this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleEvent({
          articleId,
          actor: currentUser,
          previousArticleData: previousSnapshot,
          updatedArticleData: updatedSnapshot,
          language,
          action: "remove_language",
        }),
      );
    }

    return updatedArticle;
  }

  async deleteArticle(articleId: UUIDType, currentUser?: CurrentUser) {
    await this.checkAccess(currentUser?.userId);
    await this.checkEditAccess(articleId, currentUser);

    const existingArticle = await this.validateArticleExists(articleId, undefined, false);

    if (existingArticle.archived) return;

    const [deletedArticle] = await this.articlesRepository.archiveArticle(
      articleId,
      currentUser?.userId ?? null,
    );

    if (!deletedArticle) throw new BadRequestException("adminArticleView.toast.deleteError");

    if (currentUser) {
      this.eventBus.publish(
        new DeleteArticleEvent({
          articleId,
          actor: currentUser,
          baseLanguage: existingArticle.baseLanguage,
          availableLocales: existingArticle.availableLocales,
          title: this.extractTitleByLanguage(existingArticle.title, existingArticle.baseLanguage),
        }),
      );
    }
  }

  async getArticle(
    articleId: UUIDType,
    requestedLanguage: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUser,
  ) {
    await this.checkAccess(currentUser?.userId);

    const isAdminLike =
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR;

    if (isDraftMode && !isAdminLike)
      throw new NotFoundException("adminArticleView.toast.notFoundError");

    const accessConditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      currentUser,
    );

    const [existingArticle] = await this.articlesRepository.getArticleWithAccess(
      articleId,
      requestedLanguage,
      accessConditions,
    );

    if (!existingArticle) throw new NotFoundException("adminArticleView.toast.notFoundError");

    if (!isDraftMode && existingArticle.publishedAt === null)
      throw new NotFoundException("adminArticleView.toast.notFoundError");

    const resources = await this.getArticleResources(articleId, requestedLanguage);

    const contentWithResources = this.injectResourcesIntoContent(
      existingArticle.content,
      resources.flatList,
    );

    return {
      ...existingArticle,
      content: contentWithResources ?? "",
      plainContent: existingArticle.content ?? "",
      resources: resources.grouped,
      ...(await this.getAdjacentArticle(
        existingArticle.id,
        isDraftMode ? existingArticle.createdAt : existingArticle.publishedAt,
        requestedLanguage,
        isDraftMode,
        currentUser,
      )),
    };
  }

  async getArticlesToc(
    requestedLanguage: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUser,
  ): Promise<GetArticleTocResponse> {
    await this.checkAccess(currentUser?.userId);

    const conditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      currentUser,
      { isDraftMode },
    );

    const sections = await this.articlesRepository.getArticleSections(
      requestedLanguage,
      conditions,
      currentUser,
    );

    return { sections };
  }

  private async getAdjacentArticle(
    currentArticleId: UUIDType,
    referenceDate: string | null,
    language: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUser,
  ) {
    if (!referenceDate) {
      return { nextArticle: null, previousArticle: null };
    }

    const adjacentArticleConditions = this.articlesRepository.getVisibleArticleConditions(
      language,
      currentUser,
      { isDraftMode, excludedId: currentArticleId },
    );

    const sortColumn = isDraftMode ? articles.createdAt : articles.publishedAt;

    const { nextArticle, previousArticle } = await this.articlesRepository.getAdjacentArticleIds(
      referenceDate,
      adjacentArticleConditions,
      sortColumn,
    );

    return {
      nextArticle,
      previousArticle,
    };
  }

  async createArticleLanguage(
    articleId: UUIDType,
    createArticleBody: CreateLanguageArticle,
    currentUser: CurrentUser,
  ) {
    await this.checkEditAccess(articleId, currentUser);

    const { language } = createArticleBody;

    const existingArticle = await this.validateArticleExists(articleId, language, false);

    const previousSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (existingArticle.availableLocales.includes(language))
      throw new BadRequestException("adminArticleView.toast.languageAlreadyExists");

    const [createdLanguage] = await this.articlesRepository.createArticleLanguage(
      articleId,
      language,
      existingArticle.availableLocales,
    );

    if (!createdLanguage)
      throw new BadRequestException("adminArticleView.toast.createLanguageError");

    const updatedSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (!this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateArticleEvent({
          articleId,
          actor: currentUser,
          previousArticleData: previousSnapshot,
          updatedArticleData: updatedSnapshot,
          language,
          action: "add_language",
        }),
      );
    }

    return createdLanguage;
  }

  async uploadFileToArticle(
    articleId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    currentUser?: CurrentUser,
  ) {
    await this.checkEditAccess(articleId, currentUser);

    const fileTitle = {
      [language]: title,
    };

    const fileDescription = {
      [language]: description,
    };

    const filePath = this.getMonthlyFolderPath();

    const fileData = await this.fileService.uploadResource(
      file,
      filePath,
      RESOURCE_CATEGORIES.ARTICLES,
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      fileTitle,
      fileDescription,
      currentUser,
      { folderIncludesResource: true },
    );

    return { resourceId: fileData.resourceId };
  }

  async uploadCoverImageToArticle(
    articleId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    currentUser?: CurrentUser,
  ) {
    await this.checkEditAccess(articleId, currentUser);

    if (!file || !file.mimetype.startsWith("image/"))
      throw new BadRequestException("adminArticleView.toast.invalidCoverType");

    await this.validateArticleExists(articleId, language, false);

    const existingCover = await this.fileService.getResourcesForEntity(
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
    );

    if (existingCover.length) {
      const coverIds = existingCover.map((cover) => cover.id);
      await this.fileService.archiveResources(coverIds);
    }

    const filePath = this.getMonthlyFolderPath("covers");

    return this.fileService.uploadResource(
      file,
      filePath,
      RESOURCE_CATEGORIES.ARTICLES,
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      { [language]: title },
      { [language]: description },
      currentUser,
      { folderIncludesResource: true },
    );
  }

  private async getArticleResources(articleId: UUIDType, language: SupportedLanguages) {
    const resources = await this.fileService.getResourcesForEntity(
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      language,
    );

    const groupedResources: ArticleResources = {
      images: [],
      videos: [],
      attachments: [],
      coverImage: undefined,
    };

    const flatList: ArticleResource[] = [];

    resources.forEach((resource) => {
      const baseResource = this.mapResourceToArticleResource(resource);

      flatList.push(baseResource);

      match(resource.contentType ?? "")
        .when(
          (type) => type.startsWith("image/"),
          () => groupedResources.images.push(baseResource),
        )
        .when(
          (type) => type.startsWith("video/"),
          () => groupedResources.videos.push(baseResource),
        )
        .otherwise(() => groupedResources.attachments.push(baseResource));
    });

    const [cover] = await this.fileService.getResourcesForEntity(
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
    );

    if (cover) groupedResources.coverImage = this.mapResourceToArticleResource(cover);

    return { grouped: groupedResources, flatList };
  }

  private injectResourcesIntoContent(content: string | null, resources: ArticleResource[]) {
    if (!content) return content;
    if (!resources.length) return content;

    const $ = loadHtml(content);
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

    $("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href") || "";
      const dataResourceId = anchor.attr("data-resource-id");

      const matchingResource =
        (dataResourceId && resourceMap.get(dataResourceId as UUIDType)) ||
        resources.find((resource) => href.includes(String(resource.id)));

      if (!matchingResource) return;

      const parent = anchor.parent();

      match(matchingResource.contentType ?? "")
        .when(
          (type) => type.startsWith("image/"),
          () => {
            const imgTag = this.buildImageTag(matchingResource);
            if (parent.is("p")) {
              anchor.remove();
              parent.after(imgTag);
            } else {
              anchor.replaceWith(imgTag);
            }
          },
        )
        .when(
          (type) => type.startsWith("video/"),
          () => {
            const iframe = this.buildVideoTag(matchingResource);
            if (parent.is("p")) {
              anchor.remove();
              parent.after(iframe);
            } else {
              anchor.replaceWith(iframe);
            }
          },
        )
        .otherwise(() => {
          anchor.attr("href", matchingResource.fileUrl);
          anchor.attr("download", matchingResource.fileName ?? "");
          anchor.attr("target", "_blank");
          anchor.attr("rel", "noopener noreferrer");
          anchor.text(matchingResource.title || matchingResource.fileName || anchor.text());
        });
    });

    const bodyChildren = $("body").children();
    return $.html(bodyChildren.length ? bodyChildren : $.root().children());
  }

  private async validateArticleExists(
    articleId: UUIDType,
    language?: SupportedLanguages,
    shouldIncludeLanguage = true,
  ) {
    const [existingArticle] = await this.articlesRepository.getArticleById(articleId);

    if (!existingArticle) throw new NotFoundException("adminArticleView.toast.notFoundError");

    if (!shouldIncludeLanguage || !language) return existingArticle;

    if (!existingArticle.availableLocales.includes(language))
      throw new BadRequestException("adminArticleView.toast.invalidLanguageError");

    return existingArticle;
  }

  private async validateArticleSectionExists(
    sectionId: UUIDType,
    language?: SupportedLanguages,
    shouldIncludeLanguage = true,
  ) {
    const [existingSection] = await this.articlesRepository.getSectionById(sectionId);

    if (!existingSection) throw new NotFoundException("adminArticleView.toast.notFoundError");

    if (!shouldIncludeLanguage || !language) return existingSection;

    if (!existingSection.availableLocales.includes(language))
      throw new BadRequestException("adminArticleView.toast.invalidLanguageError");

    return existingSection;
  }

  private buildUpdateData(
    existingArticle: InferSelectModel<typeof articles>,
    updateArticleData: Partial<Omit<UpdateArticle, "language">>,
    language: SupportedLanguages,
  ): Record<string, unknown> {
    const localizableFields = ["title", "content", "summary"] as const;
    const directFields: Array<keyof Omit<UpdateArticle, "language">> = ["status", "isPublic"];

    const updateData: Record<string, unknown> = {
      ...this.localizationService.updateLocalizableFields(
        localizableFields,
        existingArticle,
        updateArticleData,
        language,
      ),
    };

    directFields.forEach((field) => {
      if (field in updateArticleData && updateArticleData[field] !== undefined)
        updateData[field] = updateArticleData[field];

      if (field === "status" && !isEmpty(updateData[field])) {
        if (updateData[field] === ARTICLE_STATUS.PUBLISHED)
          updateData["publishedAt"] = new Date().toISOString();
        if (updateData[field] === ARTICLE_STATUS.DRAFT) updateData["publishedAt"] = null;
      }
    });

    return updateData;
  }

  private mapResourceToArticleResource(resource: StoredArticleResource): ArticleResource {
    return {
      id: resource.id,
      fileUrl: resource.fileUrl,
      contentType: resource.contentType,
      title: typeof resource.title === "string" ? resource.title : undefined,
      description: typeof resource.description === "string" ? resource.description : undefined,
      fileName: this.extractOriginalFilename(resource.metadata),
    };
  }

  private buildImageTag(resource: ArticleResource) {
    return `<img src="${resource.fileUrl}" alt="${resource.title ?? ""}" />`;
  }

  private buildVideoTag(resource: ArticleResource) {
    return `<iframe controls src="${resource.fileUrl}" title="${resource.title ?? ""}"></iframe>`;
  }

  private extractOriginalFilename(metadata: StoredArticleResource["metadata"]) {
    if (!metadata || typeof metadata !== "object") return undefined;

    const { originalFilename } = metadata as ResourceMetadata;

    return typeof originalFilename === "string" ? originalFilename : undefined;
  }

  private getMonthlyFolderPath(suffix?: string) {
    const now = new Date();

    const segments = [
      RESOURCE_CATEGORIES.ARTICLES,
      now.getFullYear(),
      now.getMonth() + 1,
      suffix,
    ].filter(Boolean);

    return segments.join("/");
  }

  private async checkEditAccess(articleId: UUIDType, currentUser?: CurrentUser) {
    const [article] = await this.articlesRepository.getArticleAuthorId(articleId);

    if (
      !currentUser ||
      !(article.authorId === currentUser.userId || currentUser.role === USER_ROLES.ADMIN)
    )
      throw new BadRequestException("common.toast.noAccess");
  }

  async generateArticlePreview(
    articleId: UUIDType,
    language: SupportedLanguages,
    content: string,
  ): Promise<string> {
    await this.validateArticleExists(articleId, language);

    const resources = await this.getArticleResources(articleId, language);

    return this.injectResourcesIntoContent(content, resources.flatList) ?? content;
  }

  private async buildArticleActivitySnapshot(
    articleId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<ArticleActivityLogSnapshot> {
    const [baseData] = await this.db
      .select({
        baseLanguage: sql<SupportedLanguages>`${articles.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articles.availableLocales}`,
      })
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!baseData) throw new NotFoundException("adminArticleView.toast.notFoundError");

    const resolvedLanguage = this.resolveSnapshotLanguage(
      language,
      baseData.baseLanguage,
      baseData.availableLocales,
    );

    const [snapshot] = await this.db
      .select({
        ...getTableColumns(articles),
        title: this.localizationService.getFieldByLanguage(articles.title, resolvedLanguage),
        summary: this.localizationService.getFieldByLanguage(articles.summary, resolvedLanguage),
        content: this.localizationService.getFieldByLanguage(articles.content, resolvedLanguage),
        publishedAt: sql<string | null>`${articles.publishedAt}`,
        baseLanguage: sql<string>`${articles.baseLanguage}`,
      })
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!snapshot) throw new NotFoundException("adminArticleView.toast.notFoundError");

    return {
      ...snapshot,
      availableLocales: Array.isArray(snapshot.availableLocales)
        ? snapshot.availableLocales
        : [snapshot.availableLocales],
    };
  }

  private async buildArticleSectionActivitySnapshot(
    articleSectionId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<ArticleSectionActivityLogSnapshot> {
    const [baseData] = await this.db
      .select({
        baseLanguage: sql<SupportedLanguages>`${articleSections.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articleSections.availableLocales}`,
      })
      .from(articleSections)
      .where(eq(articleSections.id, articleSectionId));

    if (!baseData) throw new NotFoundException("adminArticleView.toast.notFoundError");

    const resolvedLanguage = this.resolveSnapshotLanguage(
      language,
      baseData.baseLanguage,
      baseData.availableLocales,
    );

    const [snapshot] = await this.db
      .select({
        ...getTableColumns(articleSections),
        title: this.localizationService.getFieldByLanguage(articleSections.title, resolvedLanguage),
        baseLanguage: sql<string>`${articleSections.baseLanguage}`,
      })
      .from(articleSections)
      .where(eq(articleSections.id, articleSectionId));

    if (!snapshot) throw new NotFoundException("adminArticleView.toast.notFoundError");

    return {
      ...snapshot,
      availableLocales: Array.isArray(snapshot.availableLocales)
        ? snapshot.availableLocales
        : [snapshot.availableLocales],
    };
  }

  private resolveSnapshotLanguage(
    requestedLanguage: SupportedLanguages | undefined,
    baseLanguage: SupportedLanguages,
    availableLocales: SupportedLanguages[] | null,
  ) {
    if (requestedLanguage && Array.isArray(availableLocales)) {
      if (availableLocales.includes(requestedLanguage)) return requestedLanguage;
    }

    return baseLanguage;
  }

  private areArticleSnapshotsEqual(
    previousSnapshot: ArticleActivityLogSnapshot | null,
    updatedSnapshot: ArticleActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }

  private areSectionSnapshotsEqual(
    previousSnapshot: ArticleSectionActivityLogSnapshot | null,
    updatedSnapshot: ArticleSectionActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }

  private extractTitleByLanguage(titleField: unknown, language: SupportedLanguages) {
    if (!titleField || typeof titleField !== "object") return undefined;

    const titleMap = titleField as Record<string, unknown>;
    const title = titleMap[language];

    return typeof title === "string" ? title : undefined;
  }

  private async checkAccess(currentUserId?: UUIDType) {
    const { articlesEnabled, unregisteredUserArticlesAccessibility } =
      await this.settingsService.getGlobalSettings();

    const hasAccess = Boolean(
      articlesEnabled && (currentUserId || unregisteredUserArticlesAccessibility),
    );

    if (!hasAccess) {
      throw new BadRequestException({ message: "common.toast.noAccess" });
    }
  }
}
