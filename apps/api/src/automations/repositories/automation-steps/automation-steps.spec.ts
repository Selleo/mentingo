import { Test } from "@nestjs/testing";

import { AutomationStepsRepository } from "./automation-steps.repository";

describe("AutomationStepsRepository", () => {
  let repository: AutomationStepsRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AutomationStepsRepository,
        {
          provide: "DB",
          useValue: {},
        },
      ],
    }).compile();

    repository = module.get(AutomationStepsRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });
});
