import { Test } from "@nestjs/testing";

import { DB } from "src/storage/db/db.providers";

import { AutomationLogsRepository } from "./automation-logs";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationLogsRepository", () => {
  let repository: AutomationLogsRepository;

  const dbMock = {
    insert: jest.fn(),
    select: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationLogsRepository,
        {
          provide: DB,
          useValue: dbMock,
        },
      ],
    }).compile();

    repository = module.get<AutomationLogsRepository>(AutomationLogsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });
});
