import { Test } from "@nestjs/testing";

import { AutomationsModule } from "./automations.module";
import { AutomationsService } from "./automations.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationsService", () => {
  let service: AutomationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AutomationsModule],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
