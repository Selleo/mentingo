import { randomBytes } from "node:crypto";

import { MicrosoftCalendarTokenEncryptionService } from "../services/microsoft-calendar-token-encryption.service";

describe("MicrosoftCalendarTokenEncryptionService", () => {
  const originalMasterKey = process.env.MASTER_KEY;

  beforeEach(() => {
    process.env.MASTER_KEY = randomBytes(32).toString("base64");
  });

  afterAll(() => {
    process.env.MASTER_KEY = originalMasterKey;
  });

  it("round-trips refresh tokens with a new envelope each time", () => {
    const service = new MicrosoftCalendarTokenEncryptionService();
    const first = service.encrypt("refresh-token");
    const second = service.encrypt("refresh-token");

    expect(first.refreshTokenCiphertext).not.toBe(second.refreshTokenCiphertext);
    expect(service.decrypt(first)).toBe("refresh-token");
    expect(service.decrypt(second)).toBe("refresh-token");
  });

  it("rejects an invalid master key", () => {
    process.env.MASTER_KEY = "invalid";
    expect(() => new MicrosoftCalendarTokenEncryptionService()).toThrow(
      "MASTER_KEY must be a base64-encoded 32-byte key",
    );
  });
});
