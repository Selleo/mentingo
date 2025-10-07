import { createUnitTest, type TestContext } from "test/create-unit-test";
import { createSettingsFactory } from "test/factory/settings.factory";
import { truncateTables } from "test/helpers/test-helpers";

import { SettingsService } from "../settings.service";

describe("SettingsService - login background", () => {
  let testContext: TestContext;
  let service: SettingsService;

  beforeAll(async () => {
    testContext = await createUnitTest();
    service = testContext.module.get<SettingsService>(SettingsService);
  }, 30000);

  afterAll(async () => {
    await testContext.teardown();
  });

  beforeEach(async () => {
    await truncateTables(testContext.db, ["settings"]);
    const globalSettingsFactory = createSettingsFactory(testContext.db, null);
    await globalSettingsFactory.create({ userId: null });
  });

  it("uploadLoginBackgroundImage should set loginBackgroundImageS3Key in global settings", async () => {
    jest.spyOn((service as any).fileService, "uploadFile").mockResolvedValue({
      fileKey: "login-backgrounds/mock.png",
      fileUrl: "https://signed.example.com/login-backgrounds/mock.png",
    });

    const fakeFile = {
      originalname: "mock.png",
      buffer: Buffer.from("test"),
      mimetype: "image/png",
      size: 4,
    } as unknown as Express.Multer.File;

    await service.uploadLoginBackgroundImage(fakeFile);

    const global = await testContext.db.query.settings.findFirst({
      where: (s, { isNull }) => isNull(s.userId),
    });

    expect(global).toBeDefined();
    // @ts-expect-error dynamic JSONB shape
    expect(global?.settings?.loginBackgroundImageS3Key).toBe("login-backgrounds/mock.png");
  });
});
