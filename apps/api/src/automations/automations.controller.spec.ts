import { Test } from "@nestjs/testing";

import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";

describe("AutomationsController", () => {
  let controller: AutomationsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [
        {
          provide: AutomationsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get(AutomationsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
