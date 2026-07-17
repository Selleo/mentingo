import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "./automations-steps.service";

import type { AutomationStepsController } from "./automations-steps.controller";
import type { TestingModule } from "@nestjs/testing";

describe("AutomationsStepsController", () => {
  let controller: AutomationStepsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsStepsController],
      providers: [
        {
          provide: AutomationStepsService,
          useValue: {
            createAutomationStep: jest.fn(),
            getAutomationStepById: jest.fn(),
            getAllAutomationSteps: jest.fn(),
            updateAutomationStep: jest.fn(),
            deleteAutomationStep: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AutomationsStepsController>(AutomationsStepsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
