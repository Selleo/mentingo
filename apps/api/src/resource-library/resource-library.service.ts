import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ENTITY_TYPES,
  PERMISSIONS,
  RESOURCE_VISIBILITY,
  VIDEO_EMBED_PROVIDERS,
  type ResourceVisibility,
  type SupportedLanguages,
} from "@repo/shared";

import { DatabasePg } from "src/common";
import { parsePagination } from "src/common/pagination";
import { hasPermission } from "src/common/permissions/permission.utils";
import { RESOURCE_CATEGORIES, RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { getVideoProviderFromReference } from "src/file/utils/videoProvider";
import { ResourceLibraryRepository } from "src/resource-library/resource-library.repository";
import { DB } from "src/storage/db/db.providers";

import { NEW_ASSET_THRESHOLD_MS } from "./resource-library.constants";
import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
  removeResourceReferencesFromRichText,
} from "./resource-library.utils";

import type {
  AssetLibraryAsset,
  LinkAssetBody,
  BulkUpdateAssetVisibilityBody,
  ResourceLibraryAssetType,
  RichTextAssetEntityType,
  UnlinkAssetBody,
  UpdateAssetVisibilityBody,
  UploadAssetBody,
} from "./schemas/resource-library.schema";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ResourceLibraryService {
  constructor(
    private readonly fileService: FileService,
    private readonly resourceLibraryRepository: ResourceLibraryRepository,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  async getAssets(params: {
    page?: number;
    perPage?: number;
    search?: string;
    type?: ResourceLibraryAssetType;
    language?: SupportedLanguages;
    currentUser: CurrentUserType;
  }): Promise<{
    data: AssetLibraryAsset[];
    pagination: Pagination;
    appliedFilters: { search?: string; type?: ResourceLibraryAssetType };
  }> {
    const { page, perPage } = parsePagination(params.page, params.perPage);

    const { rows, totalItems } = await this.resourceLibraryRepository.getAssets({
      page,
      perPage,
      search: params.search,
      type: params.type,
      language: params.language,
      currentUserId: params.currentUser.userId,
      isAdmin: this.canManageAllAssets(params.currentUser),
    });

    return {
      data: rows.map((asset) => {
        const videoProvider = getVideoProviderFromReference(asset.reference);

        return {
          ...asset,
          canChangeVisibility:
            asset.visibility !== RESOURCE_VISIBILITY.HIDDEN &&
            (this.canManageAllAssets(params.currentUser) ||
              asset.uploadedBy === params.currentUser.userId),
          isNew:
            asset.uploadedBy === params.currentUser.userId &&
            Date.now() - new Date(asset.createdAt).getTime() < NEW_ASSET_THRESHOLD_MS,
          videoProvider:
            asset.type === "video" || videoProvider === VIDEO_EMBED_PROVIDERS.BUNNY
              ? videoProvider
              : undefined,
        };
      }),
      pagination: { totalItems, page, perPage },
      appliedFilters: {
        search: params.search,
        type: params.type,
      },
    };
  }

  async getAssetUsages(
    resourceId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ) {
    await this.assertAssetAccess(resourceId, currentUser);

    const relationUsages = await this.resourceLibraryRepository.getAssetRelationUsages(
      resourceId,
      language,
    );
    const contentUsages = await this.resourceLibraryRepository.getAssetContentReferenceUsages(
      resourceId,
      language,
    );
    const usageByEntity = new Map<string, (typeof relationUsages)[number]>();

    [...contentUsages, ...relationUsages].forEach((usage) => {
      usageByEntity.set(`${usage.entityType}:${usage.entityId}`, usage);
    });

    return Array.from(usageByEntity.values());
  }

  async linkAsset(resourceId: UUIDType, body: LinkAssetBody, currentUser: CurrentUserType) {
    await this.assertAssetAccess(resourceId, currentUser);
    await this.assertEntityAccess(body.entityType, body.entityId, currentUser);

    const relationshipType = body.relationshipType ?? RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT;

    await this.resourceLibraryRepository.createAssetRelation({
      resourceId,
      entityId: body.entityId,
      entityType: body.entityType,
      relationshipType,
    });

    return {
      resourceId,
      url: this.buildResourceUrl(resourceId, body.entityType),
    };
  }

  async unlinkAsset(resourceId: UUIDType, body: UnlinkAssetBody, currentUser: CurrentUserType) {
    await this.assertAssetAccess(resourceId, currentUser);
    await this.assertEntityAccess(body.entityType, body.entityId, currentUser);

    const relationshipType = body.relationshipType ?? RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT;

    const deletedUsages = await this.resourceLibraryRepository.deleteAssetRelation({
      resourceId,
      entityId: body.entityId,
      entityType: body.entityType,
      relationshipType,
    });

    return {
      resourceId,
      deletedUsages,
    };
  }

  async uploadAsset(
    file: Express.Multer.File,
    body: UploadAssetBody,
    currentUser: CurrentUserType,
  ) {
    if (!file) throw new BadRequestException("resourceLibrary.error.fileRequired");

    if (body.entityId) await this.assertEntityAccess(body.entityType, body.entityId, currentUser);

    const result = await this.fileService.uploadResource({
      file,
      folder: body.entityId ?? body.contextId ?? "library",
      resource: this.getResourceCategory(body.entityType),
      title: { [body.language]: body.title },
      description: { [body.language]: body.description },
      currentUser,
      options: {
        contextId: body.contextId,
        visibility: body.visibility ?? RESOURCE_VISIBILITY.PUBLIC,
      },
    });

    return {
      resourceId: result.resourceId,
      url: this.buildResourceUrl(result.resourceId, body.entityType),
      fileUrl: result.fileUrl,
    };
  }

  async deleteAsset(resourceId: UUIDType, currentUser: CurrentUserType) {
    await this.assertAssetAccess(resourceId, currentUser);

    const references = await this.resourceLibraryRepository.getAssetEntityReferences(resourceId);
    if (references.length) {
      for (const reference of references) {
        await this.assertEntityAccess(reference.entityType, reference.entityId, currentUser);
      }
    } else {
      const canManageAll = [
        PERMISSIONS.COURSE_UPDATE,
        PERMISSIONS.ARTICLE_MANAGE,
        PERMISSIONS.NEWS_MANAGE,
      ].some((permission) => hasPermission(currentUser.permissions, permission));
      const assetOwnerId = await this.resourceLibraryRepository.getAssetOwnerId(resourceId);

      if (!canManageAll && assetOwnerId !== currentUser.userId) {
        throw new ForbiddenException("common.toast.noAccess");
      }
    }

    const deletedUsages = await this.db.transaction(async (trx) => {
      const relationCount = await this.resourceLibraryRepository.countAssetRelations(
        resourceId,
        trx,
      );

      await this.removeAssetReferencesFromContent(resourceId, trx);
      await this.resourceLibraryRepository.deleteAssetRelations(resourceId, trx);
      await this.resourceLibraryRepository.archiveAsset(resourceId, trx);

      return relationCount;
    });

    return {
      message: "resourceLibrary.toast.assetDeletedSuccessfully",
      deletedUsages,
    };
  }

  async updateAssetVisibility(
    resourceId: UUIDType,
    body: UpdateAssetVisibilityBody,
    currentUser: CurrentUserType,
  ) {
    await this.assertCanChangeVisibility(resourceId, currentUser);

    const asset = await this.resourceLibraryRepository.updateAssetVisibility(
      resourceId,
      body.visibility,
    );

    if (!asset) throw new NotFoundException("resourceLibrary.error.assetNotFound");

    return asset;
  }

  async bulkUpdateAssetVisibility(
    body: BulkUpdateAssetVisibilityBody,
    currentUser: CurrentUserType,
  ) {
    const updatedIds: UUIDType[] = [];
    const skippedIds: UUIDType[] = [];
    const editableAssets: Array<{ id: UUIDType; visibility: ResourceVisibility }> = [];

    for (const resourceId of [...new Set(body.resourceIds)]) {
      const asset = await this.assertCanChangeVisibility(resourceId, currentUser);
      if (asset.visibility === body.visibility) {
        skippedIds.push(resourceId);
        continue;
      }
      editableAssets.push(asset);
    }

    const affectedUsedAssetCount =
      body.visibility === RESOURCE_VISIBILITY.PRIVATE
        ? (
            await Promise.all(
              editableAssets.map(async (asset) => {
                const [relationUsages, contentUsages] = await Promise.all([
                  this.resourceLibraryRepository.getAssetRelationUsages(asset.id),
                  this.resourceLibraryRepository.getAssetContentReferenceUsages(asset.id),
                ]);
                return relationUsages.length + contentUsages.length > 0;
              }),
            )
          ).filter(Boolean).length
        : 0;

    if (affectedUsedAssetCount > 0 && !body.confirmUsedAssetPrivacyChange) {
      return {
        updatedIds,
        skippedIds,
        requiresConfirmation: true,
        affectedUsedAssetCount,
      };
    }

    for (const asset of editableAssets) {
      await this.resourceLibraryRepository.updateAssetVisibility(asset.id, body.visibility);
      updatedIds.push(asset.id);
    }

    return { updatedIds, skippedIds, requiresConfirmation: false, affectedUsedAssetCount };
  }

  async syncLessonAssetRelations(lessonId: UUIDType, dbInstance?: DatabasePg) {
    const description = await this.resourceLibraryRepository.getLessonContent(lessonId, dbInstance);

    await this.syncEntityAssetRelations({
      entityId: lessonId,
      entityType: ENTITY_TYPES.LESSON,
      contents: getLocalizedRichTextEntries(description).map(([, content]) => content),
      dbInstance,
    });
  }

  async syncArticleAssetRelations(articleId: UUIDType) {
    const content = await this.resourceLibraryRepository.getArticleContent(articleId);

    await this.syncEntityAssetRelations({
      entityId: articleId,
      entityType: ENTITY_TYPES.ARTICLES,
      contents: getLocalizedRichTextEntries(content).map(
        ([, localizedContent]) => localizedContent,
      ),
    });
  }

  async syncNewsAssetRelations(newsId: UUIDType) {
    const content = await this.resourceLibraryRepository.getNewsContent(newsId);

    await this.syncEntityAssetRelations({
      entityId: newsId,
      entityType: ENTITY_TYPES.NEWS,
      contents: getLocalizedRichTextEntries(content).map(
        ([, localizedContent]) => localizedContent,
      ),
    });
  }

  private async assertAssetAccess(resourceId: UUIDType, currentUser: CurrentUserType) {
    const asset = await this.resourceLibraryRepository.getAsset(resourceId);

    if (!asset || asset.archived || asset.visibility === RESOURCE_VISIBILITY.HIDDEN) {
      throw new NotFoundException("resourceLibrary.error.assetNotFound");
    }

    if (
      asset.visibility === RESOURCE_VISIBILITY.PRIVATE &&
      !this.canManageAllAssets(currentUser) &&
      asset.uploadedBy !== currentUser.userId
    ) {
      throw new NotFoundException("resourceLibrary.error.assetNotFound");
    }

    return asset;
  }

  private async assertCanChangeVisibility(resourceId: UUIDType, currentUser: CurrentUserType) {
    const asset = await this.assertAssetAccess(resourceId, currentUser);

    if (!this.canManageAllAssets(currentUser) && asset.uploadedBy !== currentUser.userId) {
      throw new ForbiddenException("common.toast.noAccess");
    }

    return asset;
  }

  private canManageAllAssets(currentUser: CurrentUserType) {
    return hasPermission(currentUser.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE);
  }

  private async assertEntityAccess(
    entityType: RichTextAssetEntityType,
    entityId: UUIDType,
    currentUser: CurrentUserType,
  ) {
    const authorId = await this.resourceLibraryRepository.getEntityAuthorId(entityType, entityId);

    if (!authorId) throw new NotFoundException("resourceLibrary.error.entityNotFound");

    const permissionsByEntity = {
      [ENTITY_TYPES.ARTICLES]: [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
      [ENTITY_TYPES.NEWS]: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN],
      [ENTITY_TYPES.LESSON]: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
    } as const;
    const [managePermission, manageOwnPermission] = permissionsByEntity[entityType];

    const canManage = hasPermission(currentUser.permissions, managePermission);
    const canManageOwn =
      hasPermission(currentUser.permissions, manageOwnPermission) &&
      currentUser.userId === authorId;

    if (!canManage && !canManageOwn) {
      throw new ForbiddenException("common.toast.noAccess");
    }
  }

  private buildResourceUrl(resourceId: UUIDType, entityType: RichTextAssetEntityType) {
    switch (entityType) {
      case ENTITY_TYPES.ARTICLES:
        return `/api/articles/articles-resource/${resourceId}`;
      case ENTITY_TYPES.NEWS:
        return `/api/news/news-resource/${resourceId}`;
      case ENTITY_TYPES.LESSON:
      default:
        return `/api/lesson/lesson-resource/${resourceId}`;
    }
  }

  private getResourceCategory(entityType: RichTextAssetEntityType) {
    switch (entityType) {
      case ENTITY_TYPES.ARTICLES:
        return RESOURCE_CATEGORIES.ARTICLES;
      case ENTITY_TYPES.NEWS:
        return RESOURCE_CATEGORIES.NEWS;
      case ENTITY_TYPES.LESSON:
      default:
        return RESOURCE_CATEGORIES.LESSON;
    }
  }

  private async syncEntityAssetRelations(params: {
    entityId: UUIDType;
    entityType: RichTextAssetEntityType;
    contents: string[];
    dbInstance?: DatabasePg;
  }) {
    const resourceIds = [
      ...new Set(params.contents.flatMap((content) => extractResourceIdsFromRichText(content))),
    ] as UUIDType[];

    const replaceRelations = (dbInstance: DatabasePg) =>
      this.resourceLibraryRepository.replaceEntityAttachmentRelations(
        {
          entityId: params.entityId,
          entityType: params.entityType,
          resourceIds,
        },
        dbInstance,
      );

    if (params.dbInstance) {
      await replaceRelations(params.dbInstance);
      return;
    }

    await this.db.transaction(replaceRelations);
  }

  private async removeAssetReferencesFromContent(resourceId: UUIDType, dbInstance: DatabasePg) {
    const lessonRows = await this.resourceLibraryRepository.getLessonRowsReferencingAsset(
      resourceId,
      dbInstance,
    );

    for (const { id, description } of lessonRows) {
      for (const [language, localizedContent] of getLocalizedRichTextEntries(description)) {
        const { content, hasChanged } = removeResourceReferencesFromRichText(
          localizedContent,
          resourceId,
        );

        if (hasChanged) {
          await this.resourceLibraryRepository.updateLessonDescription(
            { lessonId: id, language, content },
            dbInstance,
          );
        }
      }
    }

    const articleRows = await this.resourceLibraryRepository.getArticleRowsReferencingAsset(
      resourceId,
      dbInstance,
    );

    for (const { id, content } of articleRows) {
      for (const [language, localizedContent] of getLocalizedRichTextEntries(content)) {
        const { content: cleanedContent, hasChanged } = removeResourceReferencesFromRichText(
          localizedContent,
          resourceId,
        );

        if (hasChanged) {
          await this.resourceLibraryRepository.updateArticleContent(
            { articleId: id, language, content: cleanedContent },
            dbInstance,
          );
        }
      }
    }

    const newsRows = await this.resourceLibraryRepository.getNewsRowsReferencingAsset(
      resourceId,
      dbInstance,
    );

    for (const { id, content } of newsRows) {
      for (const [language, localizedContent] of getLocalizedRichTextEntries(content)) {
        const { content: cleanedContent, hasChanged } = removeResourceReferencesFromRichText(
          localizedContent,
          resourceId,
        );

        if (hasChanged) {
          await this.resourceLibraryRepository.updateNewsContent(
            { newsId: id, language, content: cleanedContent },
            dbInstance,
          );
        }
      }
    }
  }
}
