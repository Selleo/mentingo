import { Test } from "@nestjs/testing";

import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationsService", () => {
  let service: AutomationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        {
          provide: AutomationsRepository,
          useValue: {
            changeStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
