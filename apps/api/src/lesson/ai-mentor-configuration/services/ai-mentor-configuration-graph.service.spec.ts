import { BadRequestException } from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";

import { AiMentorConfigurationGraphService } from "./ai-mentor-configuration-graph.service";

import type { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";
import type { DatabasePg, UUIDType } from "src/common";

describe("AiMentorConfigurationGraphService", () => {
  const configurationId = "00000000-0000-4000-8000-000000000001" as UUIDType;
  const aiMentorConfigurationRepository = {
    findConfigurationRoot: jest.fn(),
    findTeacherConfiguration: jest.fn(),
    findRoleplayConfiguration: jest.fn(),
  };
  const service = new AiMentorConfigurationGraphService(
    {} as DatabasePg,
    aiMentorConfigurationRepository as unknown as AiMentorConfigurationRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
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
});
