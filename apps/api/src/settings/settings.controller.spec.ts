import { Test } from "@nestjs/testing";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

import type { TestingModule } from "@nestjs/testing";

describe("SettingsController", () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [SettingsService],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
