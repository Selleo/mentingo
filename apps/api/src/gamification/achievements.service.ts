import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import { FileService } from "src/file/file.service";

import { AchievementsRepository } from "./achievements.repository";

import type {
  Achievement,
  AchievementImageUploadResponse,
  CreateAchievementBody,
  UpdateAchievementBody,
} from "./schemas/achievement.schema";
import type { UUIDType } from "src/common";

const ACHIEVEMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

@Injectable()
export class AchievementsService {
  constructor(
    private readonly achievementsRepository: AchievementsRepository,
    private readonly fileService: FileService,
  ) {}

  async findAll(params: {
    tenantId: UUIDType;
    includeInactive?: boolean;
    language?: SupportedLanguages;
  }): Promise<Achievement[]> {
    const achievements = await this.achievementsRepository.findAll({
      tenantId: params.tenantId,
      includeInactive: params.includeInactive ?? false,
      language: params.language ?? SUPPORTED_LANGUAGES.EN,
    });

    return await Promise.all(achievements.map((achievement) => this.withImageUrl(achievement)));
  }

  async findById(params: {
    id: UUIDType;
    tenantId: UUIDType;
    language?: SupportedLanguages;
  }): Promise<Achievement> {
    const achievement = await this.achievementsRepository.findById({
      id: params.id,
      tenantId: params.tenantId,
      language: params.language ?? SUPPORTED_LANGUAGES.EN,
    });

    if (!achievement) throw new NotFoundException("achievements.error.notFound");

    return await this.withImageUrl(achievement);
  }

  async create(tenantId: UUIDType, payload: CreateAchievementBody): Promise<Achievement> {
    const created = await this.achievementsRepository.create(tenantId, payload);

    return await this.findById({ id: created.id, tenantId });
  }

  async update(params: {
    id: UUIDType;
    tenantId: UUIDType;
    payload: UpdateAchievementBody;
  }): Promise<Achievement> {
    const updated = await this.achievementsRepository.update(params);

    if (!updated) throw new NotFoundException("achievements.error.notFound");

    return await this.findById({ id: updated.id, tenantId: params.tenantId });
  }

  async softDelete(id: UUIDType, tenantId: UUIDType): Promise<Achievement> {
    const updated = await this.achievementsRepository.softDelete(id, tenantId);

    if (!updated) throw new NotFoundException("achievements.error.notFound");

    return await this.findById({ id: updated.id, tenantId });
  }

  private async withImageUrl(achievement: Achievement): Promise<Achievement> {
    return {
      ...achievement,
      imageUrl: await this.fileService.getFileUrl(achievement.imageReference),
    };
  }

  async uploadImage(file: Express.Multer.File): Promise<AchievementImageUploadResponse> {
    if (!file?.mimetype || !ACHIEVEMENT_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("achievements.error.invalidImageType");
    }

    const uploaded = await this.fileService.uploadFile(file, "achievements");

    return {
      fileKey: uploaded.fileKey,
      fileUrl: uploaded.fileUrl,
    };
  }
}
