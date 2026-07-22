import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationRunnerService } from "./automation-runner.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationRunnerService", () => {
  let service: AutomationRunnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationRunnerService,
        {
          provide: AutomationStepsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AutomationRunnerService>(AutomationRunnerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
