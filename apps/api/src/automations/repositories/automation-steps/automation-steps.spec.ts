import { Test } from "@nestjs/testing";

import { AutomationSteps } from "./automation-steps";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationSteps", () => {
  let provider: AutomationSteps;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationSteps],
    }).compile();

    provider = module.get<AutomationSteps>(AutomationSteps);
  });

  it("should be defined", () => {
    expect(provider).toBeDefined();
  });
});
