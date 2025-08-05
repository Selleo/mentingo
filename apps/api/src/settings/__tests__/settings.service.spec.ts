import { createUnitTest, type TestContext } from "test/create-unit-test";

import { SettingsService } from "../settings.service";

describe("SettingsService", () => {
  let testContext: TestContext;
  let service: SettingsService;

  beforeAll(async () => {
    testContext = await createUnitTest();
    service = testContext.module.get<SettingsService>(SettingsService);
  }, 30000);

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
