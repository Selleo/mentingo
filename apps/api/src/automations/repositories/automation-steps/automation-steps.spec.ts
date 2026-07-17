import { Test } from "@nestjs/testing";

import { AutomationStepsRepository } from "./automation-steps.repository";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationSteps", () => {
  let provider: AutomationStepsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationStepsRepository],
    }).compile();

    provider = module.get<AutomationStepsRepository>(AutomationStepsRepository);
  });

  it("should be defined", () => {
    expect(provider).toBeDefined();
  });
});
