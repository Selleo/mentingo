import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ENTITY_TYPES, type SupportedLanguages } from "@repo/shared";

import { parsePagination } from "src/common/pagination";
import { RESOURCE_CATEGORIES, RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { ResourceLibraryRepository } from "src/resource-library/resource-library.repository";

import type {
  AssetLibraryAsset,
  LinkAssetBody,
  ResourceLibraryAssetType,
  RichTextAssetEntityType,
  UnlinkAssetBody,
  UploadAssetBody,
} from "./schemas/resource-library.schema";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ResourceLibraryService {
  constructor(
    private readonly fileService: FileService,
    private readonly resourceLibraryRepository: ResourceLibraryRepository,
  ) {}

  async getAssets(params: {
    page?: number;
    perPage?: number;
    search?: string;
    type?: ResourceLibraryAssetType;
    language?: SupportedLanguages;
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
    });

    return {
      data: rows,
      pagination: { totalItems, page, perPage },
      appliedFilters: {
        search: params.search,
        type: params.type,
      },
    };
  }

  async getAssetUsages(resourceId: UUIDType, language?: SupportedLanguages) {
    await this.assertAssetExists(resourceId);
    return this.resourceLibraryRepository.getAssetUsages(resourceId, language);
  }

  async linkAsset(resourceId: UUIDType, body: LinkAssetBody) {
    await this.assertAssetExists(resourceId);
    await this.assertEntityExists(body.entityType, body.entityId);

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

  async unlinkAsset(resourceId: UUIDType, body: UnlinkAssetBody) {
    await this.assertAssetExists(resourceId);

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

    if (body.entityId) await this.assertEntityExists(body.entityType, body.entityId);

    const result = await this.fileService.uploadResource({
      file,
      folder: body.entityId ?? body.contextId ?? "library",
      resource: this.getResourceCategory(body.entityType),
      title: { [body.language]: body.title },
      description: { [body.language]: body.description },
      currentUser,
      options: {
        contextId: body.contextId,
      },
    });

    return {
      resourceId: result.resourceId,
      url: this.buildResourceUrl(result.resourceId, body.entityType),
      fileUrl: result.fileUrl,
    };
  }

  async deleteAsset(resourceId: UUIDType) {
    await this.assertAssetExists(resourceId);

    const deletedUsages =
      await this.resourceLibraryRepository.archiveAssetAndDeleteRelations(resourceId);

    return {
      message: "resourceLibrary.toast.assetDeletedSuccessfully",
      deletedUsages,
    };
  }

  private async assertAssetExists(resourceId: UUIDType) {
    const assetExists = await this.resourceLibraryRepository.assetExists(resourceId);

    if (!assetExists) throw new NotFoundException("resourceLibrary.error.assetNotFound");
  }

  private async assertEntityExists(entityType: RichTextAssetEntityType, entityId: UUIDType) {
    const exists = await this.resourceLibraryRepository.entityExists(entityType, entityId);

    if (!exists) throw new NotFoundException("resourceLibrary.error.entityNotFound");
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
}
