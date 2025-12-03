import { Test, type TestingModule } from "@nestjs/testing";

import { ActivityLogsService } from "../activity-logs.service";

describe("ActivityLogsService", () => {
  let service: ActivityLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityLogsService],
    }).compile();

    service = module.get<ActivityLogsService>(ActivityLogsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
