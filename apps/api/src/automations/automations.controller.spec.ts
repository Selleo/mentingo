import { Test } from "@nestjs/testing";

import { AutomationsController } from "./automations.controller";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationsController", () => {
  let controller: AutomationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
    }).compile();

    controller = module.get<AutomationsController>(AutomationsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
