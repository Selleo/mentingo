import { BadRequestException } from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";

import { AiMentorConfigurationGraphService } from "./ai-mentor-configuration-graph.service";

import type { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";
import type { DatabasePg, UUIDType } from "src/common";

describe("AiMentorConfigurationGraphService", () => {
  const configurationId = "00000000-0000-4000-8000-000000000001" as UUIDType;
  const transaction = {} as DatabasePg;
  const db = {
    transaction: jest.fn(async (callback: (transaction: DatabasePg) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const aiMentorConfigurationRepository = {
    findConfigurationRoot: jest.fn(),
    findTeacherConfiguration: jest.fn(),
    findRoleplayConfiguration: jest.fn(),
    updateConfigurationRootTranslations: jest.fn(),
    updateTeacherConfigurationTranslations: jest.fn(),
    updateRoleplayConfigurationTranslations: jest.fn(),
  };
  const service = new AiMentorConfigurationGraphService(
    db as unknown as DatabasePg,
    aiMentorConfigurationRepository as unknown as AiMentorConfigurationRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    db.transaction.mockImplementation(
      async (callback: (transaction: DatabasePg) => Promise<unknown>) => callback(transaction),
    );
  });

  it("loads only the Teacher subtype selected by the root", async () => {
    const configuration = { id: configurationId, type: AI_MENTOR_TYPE.TEACHER };
    const teacherConfiguration = { configurationId };
    aiMentorConfigurationRepository.findConfigurationRoot.mockResolvedValue(configuration);
    aiMentorConfigurationRepository.findTeacherConfiguration.mockResolvedValue(
      teacherConfiguration,
    );

    await expect(service.getValidatedGraph(configurationId)).resolves.toEqual({
      configuration,
      teacherConfiguration,
      roleplayConfiguration: null,
    });
    expect(aiMentorConfigurationRepository.findRoleplayConfiguration).not.toHaveBeenCalled();
  });

  it("loads only the Roleplay subtype selected by the root", async () => {
    const configuration = { id: configurationId, type: AI_MENTOR_TYPE.ROLEPLAY };
    const roleplayConfiguration = { configurationId };
    aiMentorConfigurationRepository.findConfigurationRoot.mockResolvedValue(configuration);
    aiMentorConfigurationRepository.findRoleplayConfiguration.mockResolvedValue(
      roleplayConfiguration,
    );

    await expect(service.getValidatedGraph(configurationId)).resolves.toEqual({
      configuration,
      teacherConfiguration: null,
      roleplayConfiguration,
    });
    expect(aiMentorConfigurationRepository.findTeacherConfiguration).not.toHaveBeenCalled();
  });

  it("rejects a root without its selected subtype", async () => {
    aiMentorConfigurationRepository.findConfigurationRoot.mockResolvedValue({
      id: configurationId,
      type: AI_MENTOR_TYPE.TEACHER,
    });
    aiMentorConfigurationRepository.findTeacherConfiguration.mockResolvedValue(undefined);

    await expect(service.getValidatedGraph(configurationId)).rejects.toEqual(
      new BadRequestException("aiMentorConfiguration.errors.invalidGraph"),
    );
  });

  it("skips the root update when a translation only contains subtype fields", async () => {
    const configuration = { id: configurationId, type: AI_MENTOR_TYPE.ROLEPLAY };
    const roleplayConfiguration = { configurationId };
    aiMentorConfigurationRepository.findConfigurationRoot.mockResolvedValue(configuration);
    aiMentorConfigurationRepository.findRoleplayConfiguration.mockResolvedValue(
      roleplayConfiguration,
    );
    aiMentorConfigurationRepository.updateRoleplayConfigurationTranslations.mockResolvedValue(
      roleplayConfiguration,
    );

    await service.updateTranslations(configurationId, "de", {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "Ein Kundengespräch.",
    });

    expect(
      aiMentorConfigurationRepository.updateConfigurationRootTranslations,
    ).not.toHaveBeenCalled();
    expect(
      aiMentorConfigurationRepository.updateRoleplayConfigurationTranslations,
    ).toHaveBeenCalledWith(
      configurationId,
      "de",
      { type: AI_MENTOR_TYPE.ROLEPLAY, scenario: "Ein Kundengespräch." },
      transaction,
    );
  });
});
