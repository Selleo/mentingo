import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";

import { ThumbnailService } from "../thumbnail.service";

describe("ThumbnailService", () => {
  const resourceId = "11111111-1111-1111-1111-111111111111";
  const bunnyVideoId = "22222222-2222-2222-2222-222222222222";

  const createService = () => {
    const resourceWhere = jest.fn().mockResolvedValue([
      {
        id: resourceId,
        reference: `bunny-${bunnyVideoId}`,
        tenantId: "33333333-3333-3333-3333-333333333333",
      },
    ]);
    const resourceLinksWhere = jest.fn().mockResolvedValue([
      {
        entityType: "unknown",
        entityId: "44444444-4444-4444-4444-444444444444",
      },
    ]);
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: jest.fn(() => ({ where: resourceWhere })) })
      .mockReturnValueOnce({ from: jest.fn(() => ({ where: resourceLinksWhere })) });
    const bunnyStreamService = {
      getThumbnailUrl: jest.fn().mockResolvedValue("https://bunny.example/thumbnail.jpg"),
    };

    const service = new ThumbnailService(
      {} as ConstructorParameters<typeof ThumbnailService>[0],
      bunnyStreamService as unknown as ConstructorParameters<typeof ThumbnailService>[1],
      { select } as unknown as ConstructorParameters<typeof ThumbnailService>[2],
    );

    return { service, bunnyStreamService, select };
  };

  it("resolves internal Bunny resource URLs before using the provider", async () => {
    const { service, bunnyStreamService, select } = createService();

    await expect(
      service.getThumbnail(
        `https://tenant.lms.localhost/api/lesson/lesson-resource/${resourceId}`,
        VIDEO_EMBED_PROVIDERS.BUNNY,
        null,
      ),
    ).resolves.toBe("https://bunny.example/thumbnail.jpg");

    expect(select).toHaveBeenCalled();
    expect(bunnyStreamService.getThumbnailUrl).toHaveBeenCalledWith(bunnyVideoId);
  });
});
