import { Test } from "@nestjs/testing";

import { AutomationStepsController } from "./automations-steps.controller";
import { AutomationStepsService } from "./automations-steps.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationStepsController", () => {
  let controller: AutomationStepsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationStepsController],
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

    controller = module.get<AutomationStepsController>(AutomationStepsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
