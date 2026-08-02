import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ARTICLE_STATUS,
  ENTITY_TYPES,
  PERMISSIONS,
  isSupportedLanguage,
  type SupportedLanguages,
} from "@repo/shared";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { isEqual } from "lodash";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import { annotateVideoAutoplayAndBlockIndexesInContent } from "src/common/utils/annotateVideoAutoplayAndBlockIndexesInContent";
import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import {
  CreateArticleEvent,
  CreateArticleLanguageEvent,
  CreateArticleSectionEvent,
  CreateSectionLanguageEvent,
  DeleteArticleEvent,
  DeleteArticleLanguageEvent,
  DeleteArticleSectionEvent,
  DeleteSectionLanguageEvent,
  UpdateArticleEvent,
  UpdateArticleSectionEvent,
} from "src/events";
import { RESOURCE_RELATIONSHIP_TYPES, RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { SEARCH_ENTITY_TYPES } from "src/global-search/global-search.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { ResourceLibraryService } from "src/resource-library/resource-library.service";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { articles, articleSections } from "src/storage/schema";
import { getLocalizedText } from "src/utils/jsonb";

import { baseArticleSectionTitle, baseArticleTitle } from "../constants";
import { ArticlesRepository } from "../repositories/articles.repository";

import type { ArticleRecord } from "../articles.types";
import type { GetArticleSectionResponse } from "../schemas/articleSection.schema";
import type { GetArticleTocResponse } from "../schemas/articleToc.schema";
import type {
  CreateArticle,
  CreateArticleSection,
  CreateLanguageArticle,
} from "../schemas/createArticle.schema";
import type { ArticleResource, ArticleResources } from "../schemas/selectArticle.schema";
import type {
  UpdateArticle,
  UpdateArticleSection,
  UpdateArticleTranslation,
} from "../schemas/updateArticle.schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Request, Response } from "express";
import type {
  ArticleActivityLogSnapshot,
  ArticleSectionActivityLogSnapshot,
} from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FilePreviewFormat, FilePreviewOptions } from "src/file/types/file-preview.type";
import type { ResourceMetadata } from "src/file/types/resource-metadata.type";
import type { LocalizedResourceForEntity } from "src/file/types/resource.types";
import type { ResourceWithUrlError } from "src/lesson/lesson-resource.types";

type StoredArticleResource = LocalizedResourceForEntity;

@Injectable()
export class ArticlesService {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly settingsService: SettingsService,
    private readonly resourceLibraryService: ResourceLibraryService,
    private readonly searchIndexService: SearchIndexService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  async createArticleSection(
    createArticleSectionBody: CreateArticleSection,
    currentUser: CurrentUserType,
  ) {
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

    await this.outboxPublisher.publish(
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
    currentUser: CurrentUserType,
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
    currentUser: CurrentUserType,
  ) {
    const { translations } = updateArticleSectionBody;
    const existingSection = await this.validateArticleSectionExists(sectionId, undefined, false);
    const previousSnapshot = await this.buildArticleSectionActivitySnapshot(
      sectionId,
      existingSection.baseLanguage,
    );

    this.validateBatchArticleSectionUpdate(translations);

    const updateData = this.buildBatchArticleSectionUpdateData(existingSection, translations);
    const [updatedSection] = await this.db
      .update(articleSections)
      .set(updateData)
      .where(eq(articleSections.id, sectionId))
      .returning({
        id: articleSections.id,
        title: this.localizationService.getFieldByLanguage(
          articleSections.title,
          existingSection.baseLanguage,
        ),
      });

    if (!updatedSection) throw new BadRequestException("adminArticleView.toast.updateError");

    const updatedSnapshot = await this.buildArticleSectionActivitySnapshot(
      sectionId,
      existingSection.baseLanguage,
    );

    if (!this.areSectionSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateArticleSectionEvent({
          articleSectionId: sectionId,
          actor: currentUser,
          previousArticleSectionData: previousSnapshot,
          updatedArticleSectionData: updatedSnapshot,
          language: existingSection.baseLanguage,
          action: "update",
        }),
      );
    }

    return updatedSection;
  }

  async createArticleSectionLanguage(
    sectionId: UUIDType,
    body: CreateArticleSection,
    currentUser: CurrentUserType,
  ) {
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
      await this.outboxPublisher.publish(
        new CreateSectionLanguageEvent({
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
    currentUser: CurrentUserType,
  ) {
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
      await this.outboxPublisher.publish(
        new DeleteSectionLanguageEvent({
          articleSectionId: sectionId,
          actor: currentUser,
          updatedArticleSectionData: updatedSnapshot,
          language,
          action: "remove_language",
        }),
      );
    }

    return updatedSection;
  }

  async deleteArticleSection(sectionId: UUIDType, currentUser: CurrentUserType) {
    const existingSection = await this.validateArticleSectionExists(sectionId, undefined, false);

    const assignedArticlesCount = await this.articlesRepository.countArticlesInSection(sectionId);

    if (assignedArticlesCount > 0)
      throw new BadRequestException("adminArticleView.toast.sectionHasAssignedArticles");

    const [deletedSection] = await this.articlesRepository.deleteSection(sectionId);

    if (!deletedSection) throw new BadRequestException("adminArticleView.toast.deleteSectionError");

    await this.outboxPublisher.publish(
      new DeleteArticleSectionEvent({
        articleSectionId: sectionId,
        actor: currentUser,
        baseLanguage: existingSection.baseLanguage,
        availableLocales: existingSection.availableLocales,
        title:
          getLocalizedText(existingSection.title, existingSection.baseLanguage, false) ?? undefined,
      }),
    );
  }

  async createArticle(createArticleBody: CreateArticle, currentUser: CurrentUserType) {
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

    await this.outboxPublisher.publish(
      new CreateArticleEvent({
        articleId: createdArticle.id,
        actor: currentUser,
        createdArticle: createdArticleSnapshot,
        language,
      }),
    );

    await this.searchIndexService.refreshArticle(createdArticle.id);

    return createdArticle;
  }

  async updateArticle(
    articleId: UUIDType,
    updateArticleBody: UpdateArticle,
    currentUser?: CurrentUserType,
    coverFiles: Express.Multer.File[] = [],
  ) {
    await this.checkEditAccess(articleId, currentUser);

    const { translations, ...updateArticleData } = updateArticleBody;

    const existingArticle = await this.validateArticleExists(articleId, undefined, false);
    const previousSnapshot = await this.buildArticleActivitySnapshot(
      articleId,
      existingArticle.baseLanguage,
    );
    const mappedCoverFiles = this.mapCoverFiles(coverFiles);

    this.validateBatchArticleUpdate(existingArticle, translations, mappedCoverFiles);

    const finalUpdateData = this.buildBatchUpdateData(
      existingArticle,
      translations,
      updateArticleData,
    );

    const hasArticleDataToUpdate = Object.keys(finalUpdateData).length > 0;

    if (!hasArticleDataToUpdate && !Object.keys(mappedCoverFiles).length)
      throw new BadRequestException("adminArticleView.toast.updateError");

    if (hasArticleDataToUpdate) {
      await this.db
        .update(articles)
        .set({ ...finalUpdateData, updatedBy: currentUser?.userId ?? null })
        .where(eq(articles.id, articleId));
    }

    const coverUploads = Object.keys(mappedCoverFiles)
      .filter(isSupportedLanguage)
      .flatMap((language) => {
        const coverFile = mappedCoverFiles[language];

        return coverFile
          ? [
              this.uploadCoverImageToArticle(
                articleId,
                coverFile,
                language,
                coverFile.originalname,
                "",
                currentUser,
              ),
            ]
          : [];
      });

    await Promise.all(coverUploads);

    const [updatedArticle] = await this.db
      .select({
        id: articles.id,
        title: this.localizationService.getFieldByLanguage(
          articles.title,
          existingArticle.baseLanguage,
        ),
      })
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!updatedArticle) throw new BadRequestException("adminArticleView.toast.updateError");

    if (translations.some(({ content }) => content !== undefined)) {
      await this.resourceLibraryService.syncArticleAssetRelations(articleId);
    }

    await this.searchIndexService.refreshArticle(articleId);

    const updatedSnapshot = await this.buildArticleActivitySnapshot(
      articleId,
      existingArticle.baseLanguage,
    );

    if (currentUser && !this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateArticleEvent({
          articleId,
          actor: currentUser,
          previousArticleData: previousSnapshot,
          updatedArticleData: updatedSnapshot,
          language: existingArticle.baseLanguage,
          action: "update",
        }),
      );
    }

    return updatedArticle;
  }

  async getArticles(requestedLanguage: SupportedLanguages, currentUser?: CurrentUserType) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.ARTICLE_READ_PUBLIC);

    const articleScope = this.getArticleScope(currentUser);
    const conditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      articleScope,
    );

    return this.articlesRepository.getArticles(requestedLanguage, conditions);
  }

  async getDraftArticles(requestedLanguage: SupportedLanguages, currentUser: CurrentUserType) {
    const { authorId } = this.getArticleScope(currentUser);
    return this.articlesRepository.getDraftArticles(requestedLanguage, authorId);
  }

  async deleteArticleLanguage(
    articleId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
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

    await this.searchIndexService.refreshArticle(articleId);

    const updatedSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (!this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new DeleteArticleLanguageEvent({
          articleId,
          actor: currentUser,
          previousArticleData: previousSnapshot,
          language,
          action: "remove_language",
        }),
      );
    }

    return updatedArticle;
  }

  async deleteArticle(articleId: UUIDType, currentUser?: CurrentUserType) {
    await this.checkEditAccess(articleId, currentUser);

    const existingArticle = await this.validateArticleExists(articleId, undefined, false);

    if (existingArticle.archived) return;

    const [deletedArticle] = await this.articlesRepository.archiveArticle(
      articleId,
      currentUser?.userId ?? null,
    );

    if (!deletedArticle) throw new BadRequestException("adminArticleView.toast.deleteError");

    await this.searchIndexService.deleteEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.ARTICLE,
      entityId: articleId,
    });

    if (currentUser) {
      await this.outboxPublisher.publish(
        new DeleteArticleEvent({
          articleId,
          actor: currentUser,
          baseLanguage: existingArticle.baseLanguage,
          availableLocales: existingArticle.availableLocales,
          title:
            getLocalizedText(existingArticle.title, existingArticle.baseLanguage, false) ??
            undefined,
        }),
      );
    }
  }

  async getArticle(
    articleId: UUIDType,
    requestedLanguage: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUserType,
  ) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.ARTICLE_READ_PUBLIC);

    const isAdminLike = hasAnyPermission(currentUser?.permissions, [
      PERMISSIONS.ARTICLE_MANAGE,
      PERMISSIONS.ARTICLE_MANAGE_OWN,
    ]);

    if (isDraftMode && !isAdminLike)
      throw new NotFoundException("adminArticleView.toast.notFoundError");

    const accessConditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      { ...this.getArticleScope(currentUser), isDraftMode },
    );

    const [existingArticle] = await this.articlesRepository.getArticleWithAccess(
      articleId,
      requestedLanguage,
      accessConditions,
      isAdminLike,
    );

    if (!existingArticle) throw new NotFoundException("adminArticleView.toast.notFoundError");

    if (!isDraftMode && existingArticle.publishedAt === null)
      throw new NotFoundException("adminArticleView.toast.notFoundError");

    const resources = await this.getArticleResources(
      articleId,
      requestedLanguage,
      existingArticle.baseLanguage,
    );
    const { html: contentWithResources } = injectResourcesIntoContent(
      existingArticle.content,
      resources.flatList,
      {
        resourceIdRegex: /articles-resource\/([0-9a-fA-F-]{36})/,
        trackNodeTypes: ["video"],
        buildImageTag: (resource) => this.buildImageTag(resource),
      },
    );

    return {
      ...existingArticle,
      content: contentWithResources ?? existingArticle.content ?? "",
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

  async getArticleResource(
    req: Request,
    res: Response,
    resourceId: UUIDType,
    currentUser?: CurrentUserType,
    preview?: FilePreviewFormat,
  ) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.ARTICLE_READ_PUBLIC);

    const resource = await this.articlesRepository.getResource(resourceId);

    if (!resource) {
      throw new NotFoundException("articlesView.resourceNotFound");
    }

    const isAdminLike = hasAnyPermission(currentUser?.permissions, [
      PERMISSIONS.ARTICLE_MANAGE,
      PERMISSIONS.ARTICLE_MANAGE_OWN,
    ]);

    if (!resource.entityId || resource.entityType !== ENTITY_TYPES.ARTICLES) {
      if (isAdminLike) {
        return this.streamArticleResource(req, res, resource.reference, {
          contentType: resource.contentType,
          preview,
        });
      }

      throw new NotFoundException("articlesView.resourceNotFound");
    }

    const [article] = await this.articlesRepository.getArticleById(resource.entityId);

    if (!article) throw new NotFoundException("Article not found");

    const isAuthor = Boolean(
      currentUser?.userId &&
        hasPermission(currentUser?.permissions, PERMISSIONS.ARTICLE_MANAGE_OWN) &&
        article.authorId === currentUser.userId,
    );
    const isPublic = Boolean(article.isPublic && article.publishedAt !== null);

    if (!isAdminLike && !isAuthor && !isPublic) {
      throw new NotFoundException("articlesView.resourceNotFound");
    }

    return this.streamArticleResource(req, res, resource.reference, {
      contentType: resource.contentType,
      preview,
    });
  }

  private async streamArticleResource(
    req: Request,
    res: Response,
    reference: string,
    options?: FilePreviewOptions,
  ) {
    const file = await this.fileService.getFileDeliveryWithPreview(reference, {
      ...options,
      range: req.headers.range,
    });

    if (file.type === FILE_DELIVERY_TYPE.REDIRECT) {
      return res.redirect(file.url);
    }

    if (!file || !file.stream) throw new Error("Error fetching file stream");

    streamFileToResponse(res, file);
  }

  async getArticlesToc(
    requestedLanguage: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUserType,
  ): Promise<GetArticleTocResponse> {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.ARTICLE_READ_PUBLIC);

    const articleScope = this.getArticleScope(currentUser);
    const conditions = this.articlesRepository.getVisibleArticleConditions(requestedLanguage, {
      ...articleScope,
      isDraftMode,
    });

    const sections = await this.articlesRepository.getArticleSections(
      requestedLanguage,
      conditions,
      articleScope.canManageArticles,
    );

    return { sections };
  }

  private async getAdjacentArticle(
    currentArticleId: UUIDType,
    referenceDate: string | null,
    language: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUserType,
  ) {
    if (!referenceDate) {
      return { nextArticle: null, previousArticle: null };
    }

    const adjacentArticleConditions = this.articlesRepository.getVisibleArticleConditions(
      language,
      {
        ...this.getArticleScope(currentUser),
        isDraftMode,
        excludedId: currentArticleId,
      },
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
    currentUser: CurrentUserType,
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

    await this.searchIndexService.refreshArticle(articleId);

    const updatedSnapshot = await this.buildArticleActivitySnapshot(articleId, language);

    if (!this.areArticleSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new CreateArticleLanguageEvent({
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
    currentUser?: CurrentUserType,
  ) {
    await this.checkEditAccess(articleId, currentUser);

    const fileTitle = {
      [language]: title,
    };

    const fileDescription = {
      [language]: description,
    };

    const filePath = this.getMonthlyFolderPath();

    const fileData = await this.fileService.uploadResource({
      file,
      folder: filePath,
      resource: RESOURCE_CATEGORIES.ARTICLES,
      title: fileTitle,
      description: fileDescription,
      currentUser,
      options: { folderIncludesResource: true },
    });

    return { resourceId: fileData.resourceId };
  }

  async uploadCoverImageToArticle(
    articleId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    currentUser?: CurrentUserType,
  ) {
    await this.checkEditAccess(articleId, currentUser);

    await this.validateArticleExists(articleId, language, false);

    const existingCover = await this.fileService.getResourcesForEntity(
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
      { requireLanguage: true },
    );

    if (existingCover.length) {
      const coverIds = existingCover.map((cover) => cover.id);
      await this.fileService.archiveResources(coverIds);
    }

    const filePath = this.getMonthlyFolderPath("covers");

    return this.fileService.uploadResource({
      file,
      folder: filePath,
      resource: RESOURCE_CATEGORIES.ARTICLES,
      entityId: articleId,
      entityType: ENTITY_TYPES.ARTICLES,
      relationshipType: RESOURCE_RELATIONSHIP_TYPES.COVER,
      title: { [language]: title },
      description: { [language]: description },
      currentUser,
      options: { folderIncludesResource: true },
    });
  }

  private async getArticleResources(
    articleId: UUIDType,
    language: SupportedLanguages,
    baseLanguage?: SupportedLanguages,
  ) {
    const resources = await this.fileService.getResourcesForEntity(
      articleId,
      ENTITY_TYPES.ARTICLES,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      language,
      { quality: IMAGE_QUALITY.MD },
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
      { quality: IMAGE_QUALITY.LG, requireLanguage: true },
    );

    let resolvedCover = cover;

    if (!resolvedCover && baseLanguage && baseLanguage !== language) {
      [resolvedCover] = await this.fileService.getResourcesForEntity(
        articleId,
        ENTITY_TYPES.ARTICLES,
        RESOURCE_RELATIONSHIP_TYPES.COVER,
        baseLanguage,
        { quality: IMAGE_QUALITY.LG, requireLanguage: true },
      );
    }

    if (resolvedCover)
      groupedResources.coverImage = this.mapResourceToArticleResource(resolvedCover);

    return { grouped: groupedResources, flatList };
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

  private validateBatchArticleSectionUpdate(translations: UpdateArticleSection["translations"]) {
    const submittedLanguages = translations.map(({ language }) => language);
    const hasDuplicateLanguage = new Set(submittedLanguages).size !== submittedLanguages.length;
    const hasTitleChange = translations.some(({ title }) => title !== undefined);

    if (!translations.length || hasDuplicateLanguage || !hasTitleChange)
      throw new BadRequestException("adminArticleView.toast.updateError");
  }

  private buildBatchArticleSectionUpdateData(
    existingSection: InferSelectModel<typeof articleSections>,
    translations: UpdateArticleSection["translations"],
  ) {
    const updateData: Record<string, unknown> = {};
    const localizableFields = ["title"] as const;

    translations.forEach((translation) => {
      Object.assign(
        updateData,
        this.localizationService.updateLocalizableFields(
          localizableFields,
          { title: articleSections.title, ...updateData },
          translation,
          translation.language,
          true,
        ),
      );
    });

    const newLocales = translations
      .map(({ language }) => language)
      .filter((language) => !existingSection.availableLocales.includes(language));

    if (newLocales.length)
      updateData["availableLocales"] = [...existingSection.availableLocales, ...newLocales];

    return updateData;
  }

  private buildBatchUpdateData(
    existingArticle: ArticleRecord,
    translations: UpdateArticleTranslation[],
    updateArticleData: Omit<UpdateArticle, "translations">,
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};
    const localizableFields = ["title", "summary", "content"] as const;

    const localizableArticleFields = {
      title: articles.title,
      summary: articles.summary,
      content: articles.content,
    };

    const normalizedTranslations = translations.map((translation) => {
      if (translation.content === undefined) return translation;

      return {
        ...translation,
        content: annotateVideoAutoplayAndBlockIndexesInContent(translation.content) ?? "",
      };
    });

    normalizedTranslations.forEach((translation) => {
      Object.assign(
        updateData,
        this.localizationService.updateLocalizableFields(
          localizableFields,
          { ...localizableArticleFields, ...updateData },
          translation,
          translation.language,
          true,
        ),
      );
    });

    const newLocales = translations
      .map(({ language }) => language)
      .filter((language) => !existingArticle.availableLocales.includes(language));

    if (newLocales.length)
      updateData["availableLocales"] = [...existingArticle.availableLocales, ...newLocales];

    if (updateArticleData.isPublic !== undefined)
      updateData["isPublic"] = updateArticleData.isPublic;

    return updateData;
  }

  private validateBatchArticleUpdate(
    existingArticle: ArticleRecord,
    translations: UpdateArticleTranslation[],
    coverFiles: Partial<Record<SupportedLanguages, Express.Multer.File>>,
  ) {
    const submittedLanguages = translations.map(({ language }) => language);
    if (new Set(submittedLanguages).size !== submittedLanguages.length)
      throw new BadRequestException("adminArticleView.toast.updateError");

    const availableLocales = [
      ...new Set([...existingArticle.availableLocales, ...submittedLanguages]),
    ];
    const allowedCoverLanguages = new Set(availableLocales);
    const hasInvalidCoverLanguage = Object.keys(coverFiles).some(
      (language) => !isSupportedLanguage(language) || !allowedCoverLanguages.has(language),
    );
    if (hasInvalidCoverLanguage)
      throw new BadRequestException("adminArticleView.toast.updateError");

    if (existingArticle.status !== ARTICLE_STATUS.PUBLISHED) return;

    const titleByLanguage = Object.fromEntries(
      availableLocales.map((language) => [
        language,
        getLocalizedText(existingArticle.title, language, false) ?? "",
      ]),
    );

    translations.forEach(({ language, title }) => {
      if (title !== undefined) titleByLanguage[language] = title;
    });

    if (availableLocales.some((language) => !titleByLanguage[language]?.trim()))
      throw new BadRequestException("adminArticleView.toast.updateError");
  }

  private mapCoverFiles(files: Express.Multer.File[]) {
    const covers: Partial<Record<SupportedLanguages, Express.Multer.File>> = {};

    files.forEach((file) => {
      const language = file.fieldname.startsWith("cover.")
        ? file.fieldname.slice("cover.".length)
        : "";
      if (!isSupportedLanguage(language) || covers[language])
        throw new BadRequestException("adminArticleView.toast.updateError");
      covers[language] = file;
    });

    return covers;
  }

  private mapResourceToArticleResource(
    resource: StoredArticleResource,
  ): ArticleResource & { fileUrlError?: boolean } {
    return {
      id: resource.id,
      fileUrl: resource.fileUrl,
      fileUrlError: Boolean((resource as ResourceWithUrlError).fileUrlError),
      contentType: resource.contentType,
      title: typeof resource.title === "string" ? resource.title : undefined,
      description: typeof resource.description === "string" ? resource.description : undefined,
      fileName: this.extractOriginalFilename(resource.metadata),
    };
  }

  private buildImageTag(resource: ArticleResource) {
    return `<img src="${resource.fileUrl}" alt="${resource.title ?? ""}" />`;
  }

  private extractOriginalFilename(metadata: StoredArticleResource["metadata"]) {
    if (!metadata || typeof metadata !== "object") return undefined;

    const { originalFilename } = metadata as StoredArticleResource["metadata"] & ResourceMetadata;

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

  private async checkEditAccess(articleId: UUIDType, currentUser?: CurrentUserType) {
    const [article] = await this.articlesRepository.getArticleAuthorId(articleId);

    if (
      !currentUser ||
      !(
        hasAnyPermission(currentUser.permissions, [PERMISSIONS.ARTICLE_MANAGE]) ||
        (hasPermission(currentUser.permissions, PERMISSIONS.ARTICLE_MANAGE_OWN) &&
          article.authorId === currentUser.userId)
      )
    )
      throw new BadRequestException("common.toast.noAccess");
  }

  async generateArticlePreview(
    articleId: UUIDType,
    language: SupportedLanguages,
    content: string,
    currentUser: CurrentUserType,
  ): Promise<string> {
    await this.checkEditAccess(articleId, currentUser);
    await this.validateArticleExists(articleId, language);

    const existingArticle = await this.validateArticleExists(articleId, language);
    const resources = await this.getArticleResources(
      articleId,
      language,
      existingArticle.baseLanguage,
    );

    const { html: parsedContent } = injectResourcesIntoContent(content, resources.flatList, {
      resourceIdRegex: /articles-resource\/([0-9a-fA-F-]{36})/,
      trackNodeTypes: ["video"],
      buildImageTag: (resource) => this.buildImageTag(resource),
    });

    return parsedContent ?? content;
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
        titleTranslations: articles.title,
        summaryTranslations: articles.summary,
        contentTranslations: articles.content,
        publishedAt: sql<string | null>`${articles.publishedAt}`,
        baseLanguage: sql<string>`${articles.baseLanguage}`,
      })
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!snapshot) throw new NotFoundException("adminArticleView.toast.notFoundError");

    const { titleTranslations, summaryTranslations, contentTranslations, ...snapshotData } =
      snapshot;
    const availableLocales = Array.isArray(snapshot.availableLocales)
      ? snapshot.availableLocales
      : [snapshot.availableLocales];

    return {
      ...snapshotData,
      availableLocales,
      translations: Object.fromEntries(
        availableLocales.map((locale) => [
          locale,
          {
            title: getLocalizedText(titleTranslations, locale, false) ?? undefined,
            summary: getLocalizedText(summaryTranslations, locale, false) ?? undefined,
            content: getLocalizedText(contentTranslations, locale, false) ?? undefined,
          },
        ]),
      ),
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
        titleTranslations: articleSections.title,
        baseLanguage: sql<string>`${articleSections.baseLanguage}`,
      })
      .from(articleSections)
      .where(eq(articleSections.id, articleSectionId));

    if (!snapshot) throw new NotFoundException("adminArticleView.toast.notFoundError");

    const { titleTranslations, ...snapshotData } = snapshot;
    const availableLocales = Array.isArray(snapshot.availableLocales)
      ? snapshot.availableLocales
      : [snapshot.availableLocales];

    return {
      ...snapshotData,
      availableLocales,
      translations: Object.fromEntries(
        availableLocales.map((locale) => [
          locale,
          { title: getLocalizedText(titleTranslations, locale, false) ?? undefined },
        ]),
      ),
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
    return isEqual(
      this.getComparableSectionSnapshot(previousSnapshot),
      this.getComparableSectionSnapshot(updatedSnapshot),
    );
  }

  private getComparableSectionSnapshot(snapshot: ArticleSectionActivityLogSnapshot | null) {
    if (!snapshot) return null;

    return {
      title: snapshot.title ?? null,
      translations: snapshot.translations ?? {},
      baseLanguage: snapshot.baseLanguage ?? null,
      availableLocales: snapshot.availableLocales ?? [],
    };
  }

  private async checkAccess(currentUserId?: UUIDType) {
    const { articlesEnabled, unregisteredUserArticlesAccessibility } =
      await this.settingsService.getGlobalSettings();

    const hasAccess = Boolean(
      articlesEnabled && (currentUserId || unregisteredUserArticlesAccessibility),
    );

    if (!hasAccess) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }
  }

  private async checkContentReadAccess(
    currentUser: CurrentUserType | undefined,
    readPermission: typeof PERMISSIONS.ARTICLE_READ_PUBLIC,
  ) {
    const { unregisteredUserArticlesAccessibility } =
      await this.settingsService.getGlobalSettings();
    const canManage = this.getArticleScope(currentUser).canManageArticles;
    const canReadPublic = hasPermission(currentUser?.permissions, readPermission);
    const hasAccess =
      canManage || canReadPublic || (!currentUser && unregisteredUserArticlesAccessibility);

    if (!hasAccess) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }
  }

  private getArticleScope(currentUser?: CurrentUserType) {
    const canManageAll = hasPermission(currentUser?.permissions, PERMISSIONS.ARTICLE_MANAGE);
    const canManageOwn = hasPermission(currentUser?.permissions, PERMISSIONS.ARTICLE_MANAGE_OWN);

    return {
      canManageArticles: canManageAll || canManageOwn,
      authorId: canManageAll ? undefined : currentUser?.userId,
      isPublicOnly: !currentUser,
    };
  }
}
