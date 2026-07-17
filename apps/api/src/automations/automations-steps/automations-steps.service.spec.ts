import { Test } from "@nestjs/testing";

import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

import { AutomationStepsService } from "./automations-steps.service";

describe("AutomationStepsService", () => {
  let service: AutomationStepsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AutomationStepsService,
        {
          provide: AutomationStepsRepository,
          useValue: {
            createAutomationStep: jest.fn(),
            getAutomationStepById: jest.fn(),
            getAllAutomationStepsByAutomationId: jest.fn(),
            updateAutomationStep: jest.fn(),
            deleteAutomationStep: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationStepsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
