import { createHmac } from "node:crypto";

import { verifyPhishingSignature } from "./phishing-webhook.utils";
const secret = "a".repeat(32),
  timestamp = "1700000000",
  body = Buffer.from('{"action":"clicked"}');
const signature = createHmac("sha256", secret)
  .update(timestamp + ".")
  .update(body)
  .digest("hex");
describe("phishing webhook authentication", () => {
  it("authenticates the exact bytes", () => {
    expect(verifyPhishingSignature(body, secret, timestamp, signature, 1700000000000)).toBe(true);
    expect(
      verifyPhishingSignature(Buffer.from("{}"), secret, timestamp, signature, 1700000000000),
    ).toBe(false);
  });
  it("rejects stale, malformed and wrong-key signatures", () => {
    expect(verifyPhishingSignature(body, secret, timestamp, signature, 1700000400000)).toBe(false);
    expect(verifyPhishingSignature(body, secret, timestamp, "bad", 1700000000000)).toBe(false);
    expect(verifyPhishingSignature(body, "b".repeat(32), timestamp, signature, 1700000000000)).toBe(
      false,
    );
  });
});
