import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { AutomationTemplateService } from "./automation-template.service";

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
        {
          provide: AutomationDataResolverService,
          useValue: {},
        },
        {
          provide: AutomationTemplateService,
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
