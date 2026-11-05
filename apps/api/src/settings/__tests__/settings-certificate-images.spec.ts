import { PgDialect } from "drizzle-orm/pg-core";

import { SettingsService } from "../settings.service";

import type { SQL } from "drizzle-orm";

describe("certificate image settings lookup", () => {
  const makeService = (rows: unknown[]) => {
    const where = jest.fn().mockResolvedValue(rows);
    const dbAdmin = { select: jest.fn(() => ({ from: () => ({ where }) })) };
    const service = Object.create(SettingsService.prototype);
    service.dbAdmin = dbAdmin;
    service.parseGlobalSettings = jest.fn((value) => value);
    return { service, where };
  };

  it("constrains raw settings by the supplied certificate tenant and global scope", async () => {
    const { service, where } = makeService([
      {
        settings: {
          platformLogoS3Key: "tenant-a/logo.png",
          certificateBackgroundImage: "tenant-a/background.png",
          primaryColor: "#123456",
        },
      },
    ]);
    const result = await service.getImageS3KeysByTenantId("tenant-a");
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(query.params).toContain("tenant-a");
    expect(query.sql).toContain('"tenant_id"');
    expect(query.sql).toContain('"user_id" is null');
    expect(result.platformLogoS3Key).toBe("tenant-a/logo.png");
    expect(result.certificateBackgroundImage).toBe("tenant-a/background.png");
  });

  it("returns no images when the tenant has not configured them", async () => {
    const { service } = makeService([{ settings: {} }]);
    const result = await service.getImageS3KeysByTenantId("tenant-a");
    expect(result.certificateBackgroundImage).toBeNull();
    expect(result.platformLogoS3Key).toBeNull();
  });

  it("does not fall back to another tenant's settings when the tenant is missing", async () => {
    const { service } = makeService([]);
    await expect(service.getImageS3KeysByTenantId("missing")).rejects.toThrow();
  });
});
