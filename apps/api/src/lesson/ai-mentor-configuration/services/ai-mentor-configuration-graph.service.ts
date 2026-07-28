import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";

import { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";

import type {
  AiMentorConfigurationContent,
  UpdateAiMentorConfigurationTranslationBody,
} from "../schemas/ai-mentor-configuration.schema";
import type { AiMentorConfigurationGraph } from "../types/ai-mentor-configuration.types";
import type { SupportedLanguages } from "@repo/shared";

@Injectable()
export class AiMentorConfigurationGraphService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly aiMentorConfigurationRepository: AiMentorConfigurationRepository,
  ) {}

  async createConfiguration(
    aiMentorLessonId: UUIDType,
    data: AiMentorConfigurationContent,
    baseLanguage: SupportedLanguages,
  ): Promise<UUIDType> {
    return this.db.transaction((transaction) =>
      this.createConfigurationInTransaction(aiMentorLessonId, data, baseLanguage, transaction),
    );
  }

  async createConfigurationInTransaction(
    aiMentorLessonId: UUIDType,
    data: AiMentorConfigurationContent,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    const root = await this.aiMentorConfigurationRepository.createConfigurationRoot(
      aiMentorLessonId,
      data,
      baseLanguage,
      transaction,
    );

    await this.createSubtype(root.id, data, baseLanguage, transaction);

    return root.id;
  }

  async replaceConfiguration(
    configurationId: UUIDType,
    data: AiMentorConfigurationContent,
    baseLanguage: SupportedLanguages,
  ): Promise<UUIDType> {
    return this.db.transaction(async (transaction) => {
      const existingGraph = await this.getValidatedGraph(configurationId, transaction);

      await this.aiMentorConfigurationRepository.updateConfigurationRoot(
        configurationId,
        data,
        baseLanguage,
        transaction,
      );

      if (existingGraph.configuration.type === data.type)
        await this.updateMatchingSubtype(configurationId, data, baseLanguage, transaction);
      else {
        await this.aiMentorConfigurationRepository.deleteTeacherConfiguration(
          configurationId,
          transaction,
        );
        await this.aiMentorConfigurationRepository.deleteRoleplayConfiguration(
          configurationId,
          transaction,
        );
        await this.createSubtype(configurationId, data, baseLanguage, transaction);
      }

      await this.getValidatedGraph(configurationId, transaction);

      return configurationId;
    });
  }

  async updateTranslations(
    configurationId: UUIDType,
    language: SupportedLanguages,
    data: UpdateAiMentorConfigurationTranslationBody,
  ) {
    return this.db.transaction(async (transaction) => {
      const graph = await this.getValidatedGraph(configurationId, transaction);

      if (graph.configuration.type !== data.type)
        throw new BadRequestException("aiMentorConfiguration.errors.typeMismatch");

      await this.aiMentorConfigurationRepository.updateConfigurationRootTranslations(
        configurationId,
        language,
        data,
        transaction,
      );

      const subtype =
        data.type === AI_MENTOR_TYPE.TEACHER
          ? await this.aiMentorConfigurationRepository.updateTeacherConfigurationTranslations(
              configurationId,
              language,
              data,
              transaction,
            )
          : await this.aiMentorConfigurationRepository.updateRoleplayConfigurationTranslations(
              configurationId,
              language,
              data,
              transaction,
            );

      if (!subtype)
        throw new NotFoundException("aiMentorConfiguration.errors.configurationNotFound");

      await this.getValidatedGraph(configurationId, transaction);
    });
  }

  async getValidatedGraph(
    configurationId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<AiMentorConfigurationGraph> {
    const configuration = await this.aiMentorConfigurationRepository.findConfigurationRoot(
      configurationId,
      dbInstance,
    );

    if (!configuration)
      throw new NotFoundException("aiMentorConfiguration.errors.configurationNotFound");

    const graph: AiMentorConfigurationGraph =
      configuration.type === AI_MENTOR_TYPE.TEACHER
        ? {
            configuration,
            teacherConfiguration:
              (await this.aiMentorConfigurationRepository.findTeacherConfiguration(
                configurationId,
                dbInstance,
              )) ?? null,
            roleplayConfiguration: null,
          }
        : {
            configuration,
            teacherConfiguration: null,
            roleplayConfiguration:
              (await this.aiMentorConfigurationRepository.findRoleplayConfiguration(
                configurationId,
                dbInstance,
              )) ?? null,
          };

    this.assertGraphIntegrity(graph);

    return graph;
  }

  private async createSubtype(
    configurationId: UUIDType,
    data: AiMentorConfigurationContent,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ) {
    if (data.type === AI_MENTOR_TYPE.TEACHER) {
      await this.aiMentorConfigurationRepository.createTeacherConfiguration(
        configurationId,
        data,
        baseLanguage,
        transaction,
      );
      return;
    }

    await this.aiMentorConfigurationRepository.createRoleplayConfiguration(
      configurationId,
      data,
      baseLanguage,
      transaction,
    );
  }

  private async updateMatchingSubtype(
    configurationId: UUIDType,
    data: AiMentorConfigurationContent,
    baseLanguage: SupportedLanguages,
    transaction: DatabasePg,
  ) {
    if (data.type === AI_MENTOR_TYPE.TEACHER) {
      const updated = await this.aiMentorConfigurationRepository.updateTeacherConfiguration(
        configurationId,
        data,
        baseLanguage,
        transaction,
      );
      if (!updated)
        throw new NotFoundException("aiMentorConfiguration.errors.configurationNotFound");
      return;
    }

    const updated = await this.aiMentorConfigurationRepository.updateRoleplayConfiguration(
      configurationId,
      data,
      baseLanguage,
      transaction,
    );
    if (!updated) throw new NotFoundException("aiMentorConfiguration.errors.configurationNotFound");
  }

  private assertGraphIntegrity(graph: AiMentorConfigurationGraph) {
    const matchingSubtype =
      graph.configuration.type === AI_MENTOR_TYPE.TEACHER
        ? graph.teacherConfiguration
        : graph.roleplayConfiguration;

    if (!matchingSubtype)
      throw new BadRequestException("aiMentorConfiguration.errors.invalidGraph");
  }
}
