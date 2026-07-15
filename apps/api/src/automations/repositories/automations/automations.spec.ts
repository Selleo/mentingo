import { Test } from "@nestjs/testing";

import { AutomationsRepository } from "./automations.repository";

import type { TestingModule } from "@nestjs/testing";

describe("Automations", () => {
  let provider: AutomationsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationsRepository],
    }).compile();

    provider = module.get<AutomationsRepository>(AutomationsRepository);
  });

  it("should be defined", () => {
    expect(provider).toBeDefined();
  });
});
