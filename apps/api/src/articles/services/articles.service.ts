import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ARTICLE_STATUS, type SupportedLanguages } from "@repo/shared";
import { load as loadHtml } from "cheerio";
import { isEmpty } from "lodash";
import { match } from "ts-pattern";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import {
  ENTITY_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
  RESOURCE_CATEGORIES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { articles } from "src/storage/schema";
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
  ) {}

  async createArticleSection(createArticleSectionBody: CreateArticleSection) {
    const { language } = createArticleSectionBody;

    const [section] = await this.articlesRepository.createArticleSection(
      language,
      buildJsonbField(language, baseArticleSectionTitle[language]),
    );

    if (!section) throw new BadRequestException("adminArticleView.toast.createSectionError");

    return section;
  }

  async getArticleSection(
    sectionId: UUIDType,
    requestedLanguage: SupportedLanguages,
  ): Promise<GetArticleSectionResponse> {
    const [section] = await this.articlesRepository.getArticleSectionDetails(
      sectionId,
      requestedLanguage,
    );

    if (!section) throw new NotFoundException("adminArticleView.toast.notFoundError");

    return section;
  }

  async updateArticleSection(sectionId: UUIDType, updateArticleSectionBody: UpdateArticleSection) {
    const { language, title } = updateArticleSectionBody;

    await this.validateArticleSectionExists(sectionId, language);

    const [updatedSection] = await this.articlesRepository.updateArticleSectionTitle(
      sectionId,
      language,
      title ?? "",
    );

    if (!updatedSection) throw new BadRequestException("adminArticleView.toast.updateError");

    return updatedSection;
  }

  async createArticleSectionLanguage(sectionId: UUIDType, body: CreateArticleSection) {
    const { language } = body;

    const existingSection = await this.validateArticleSectionExists(sectionId, language, false);

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

    return createdLanguage;
  }

  async deleteArticleSectionLanguage(sectionId: UUIDType, language: SupportedLanguages) {
    const existingSection = await this.validateArticleSectionExists(sectionId, language);

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

    return updatedSection;
  }

  async deleteArticleSection(sectionId: UUIDType) {
    await this.validateArticleSectionExists(sectionId, undefined, false);

    const assignedArticlesCount = await this.articlesRepository.countArticlesInSection(sectionId);

    if (assignedArticlesCount > 0)
      throw new BadRequestException("adminArticleView.toast.sectionHasAssignedArticles");

    const [deletedSection] = await this.articlesRepository.deleteSection(sectionId);

    if (!deletedSection) throw new BadRequestException("adminArticleView.toast.deleteSectionError");
  }

  async createArticle(createArticleBody: CreateArticle, currentUser: CurrentUser) {
    const { language, sectionId } = createArticleBody;

    await this.validateArticleSectionExists(sectionId, undefined, false);

    const [createdArticle] = await this.articlesRepository.createArticle(
      language,
      buildJsonbField(language, baseArticleTitle[language]),
      currentUser.userId,
      sectionId,
    );

    if (!createdArticle) throw new BadRequestException("adminArticleView.toast.createError");

    return createdArticle;
  }

  async updateArticle(
    articleId: UUIDType,
    updateArticleBody: UpdateArticle,
    currentUser?: CurrentUser,
    coverFile?: Express.Multer.File,
  ) {
    await this.validateAccess(articleId, currentUser);

    const { language, ...updateArticleData } = updateArticleBody;

    const existingNews = await this.validateArticleExists(articleId, language);

    const finalUpdateData = this.buildUpdateData(existingNews, updateArticleData, language);

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

    const [updatedNews] = await this.articlesRepository.updateArticle(
      articleId,
      language,
      finalUpdateData,
      currentUser?.userId ?? null,
    );

    if (!updatedNews) throw new BadRequestException("adminArticleView.toast.updateError");

    return updatedNews;
  }

  async getArticles(requestedLanguage: SupportedLanguages, currentUser?: CurrentUser) {
    const conditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      currentUser,
    );

    return this.articlesRepository.getArticles(requestedLanguage, conditions);
  }

  async getDraftArticles(requestedLanguage: SupportedLanguages) {
    return this.articlesRepository.getDraftArticles(requestedLanguage);
  }

  async deleteArticleLanguage(
    articleId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ) {
    await this.validateAccess(articleId, currentUser);

    const existingNews = await this.validateArticleExists(articleId, language);

    if (existingNews.availableLocales.length <= 1)
      throw new BadRequestException("adminArticleView.toast.minimumLanguageError");

    if (existingNews.baseLanguage === language)
      throw new BadRequestException("adminArticleView.toast.cannotRemoveBaseLanguage");

    const updatedLocales = existingNews.availableLocales.filter((locale) => locale !== language);

    const [updatedArticle] = await this.articlesRepository.deleteArticleLanguage(
      articleId,
      language,
      updatedLocales,
    );

    if (!updatedArticle)
      throw new BadRequestException("adminArticleView.toast.removeLanguageError");

    return updatedArticle;
  }

  async deleteArticle(articleId: UUIDType, currentUser?: CurrentUser) {
    await this.validateAccess(articleId, currentUser);

    const existingNews = await this.validateArticleExists(articleId, undefined, false);

    if (existingNews.archived) return;

    const [deletedArticle] = await this.articlesRepository.archiveArticle(
      articleId,
      currentUser?.userId ?? null,
    );

    if (!deletedArticle) throw new BadRequestException("adminArticleView.toast.deleteError");
  }

  async getArticle(
    articleId: UUIDType,
    requestedLanguage: SupportedLanguages,
    isDraftMode = false,
    currentUser?: CurrentUser,
  ) {
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
    const conditions = this.articlesRepository.getVisibleArticleConditions(
      requestedLanguage,
      currentUser,
      { isDraftMode },
    );

    const sections = await this.articlesRepository.getArticleSections(
      requestedLanguage,
      conditions,
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

    const adjacentNewsConditions = this.articlesRepository.getVisibleArticleConditions(
      language,
      currentUser,
      { isDraftMode, excludedId: currentArticleId },
    );

    const sortColumn = isDraftMode ? articles.createdAt : articles.publishedAt;

    const { nextArticle, previousArticle } = await this.articlesRepository.getAdjacentArticleIds(
      referenceDate,
      adjacentNewsConditions,
      sortColumn,
    );

    return {
      nextArticle,
      previousArticle,
    };
  }

  async createArticleLanguage(
    articleId: UUIDType,
    createNewsBody: CreateLanguageArticle,
    currentUser: CurrentUser,
  ) {
    await this.validateAccess(articleId, currentUser);

    const { language } = createNewsBody;

    const existingNews = await this.validateArticleExists(articleId, language, false);

    if (existingNews.availableLocales.includes(language))
      throw new BadRequestException("adminArticleView.toast.languageAlreadyExists");

    const [createdLanguage] = await this.articlesRepository.createArticleLanguage(
      articleId,
      language,
      existingNews.availableLocales,
    );

    if (!createdLanguage)
      throw new BadRequestException("adminArticleView.toast.createLanguageError");

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
    await this.validateAccess(articleId, currentUser);

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
    await this.validateAccess(articleId, currentUser);

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
      const baseResource = this.mapResourceToNewsResource(resource);

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

    if (cover) groupedResources.coverImage = this.mapResourceToNewsResource(cover);

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
    existingNews: InferSelectModel<typeof articles>,
    updateNewsData: Partial<Omit<UpdateArticle, "language">>,
    language: SupportedLanguages,
  ): Record<string, unknown> {
    const localizableFields = ["title", "content", "summary"] as const;
    const directFields: Array<keyof Omit<UpdateArticle, "language">> = ["status", "isPublic"];

    const updateData: Record<string, unknown> = {
      ...this.localizationService.updateLocalizableFields(
        localizableFields,
        existingNews,
        updateNewsData,
        language,
      ),
    };

    directFields.forEach((field) => {
      if (field in updateNewsData && updateNewsData[field] !== undefined)
        updateData[field] = updateNewsData[field];

      if (field === "status" && !isEmpty(updateData[field])) {
        if (updateData[field] === ARTICLE_STATUS.PUBLISHED)
          updateData["publishedAt"] = new Date().toISOString();
        if (updateData[field] === ARTICLE_STATUS.DRAFT) updateData["publishedAt"] = null;
      }
    });

    return updateData;
  }

  private mapResourceToNewsResource(resource: StoredArticleResource): ArticleResource {
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

  private async validateAccess(articleId: UUIDType, currentUser?: CurrentUser) {
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
}
