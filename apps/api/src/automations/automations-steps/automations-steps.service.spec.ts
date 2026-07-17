import { Test } from "@nestjs/testing";

import type { AutomationStepsService } from "./automations-steps.service";
import type { TestingModule } from "@nestjs/testing";

describe("AutomationsStepsService", () => {
  let service: AutomationStepsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationsStepsService],
    }).compile();

    service = module.get<AutomationsStepsService>(AutomationsStepsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
