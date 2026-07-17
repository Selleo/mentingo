import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "./automations-steps.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationsStepsService", () => {
  let service: AutomationStepsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationStepsService],
    }).compile();

    service = module.get<AutomationStepsService>(AutomationStepsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
