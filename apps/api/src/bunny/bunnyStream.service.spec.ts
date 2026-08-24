import { createHmac } from "crypto";

import { BunnyStreamService } from "./bunnyStream.service";

describe("Bunny webhook signatures", () => {
  it("validates v1 HMAC-SHA256 over the exact raw body", async () => {
    const service = new BunnyStreamService({} as never, {} as never);
    (service as unknown as { getConfig: jest.Mock }).getConfig = jest.fn().mockResolvedValue({
      readOnlyApiKey: "read-only-key",
    });
    const rawBody = Buffer.from('{"VideoGuid":"video-id", "Status":3}', "utf8");
    const signature = createHmac("sha256", "read-only-key").update(rawBody).digest("hex");

    await expect(
      service.validateWebhookSignature(rawBody, signature, "v1", "hmac-sha256"),
    ).resolves.toBe(true);
    await expect(
      service.validateWebhookSignature(rawBody, signature, "v2", "hmac-sha256"),
    ).resolves.toBe(false);
  });
});
