import { createHmac } from "node:crypto";

import { match } from "ts-pattern";

import { verifyPhishingSignature } from "./phishing-webhook.utils";
import {
  SIGNATURE_CASES,
  SIGNATURE_TAMPERING,
  SIGNED_AT_SECONDS,
  SIGNED_BODY,
  SIGNING_SECRET,
} from "./phishing-webhook.utils.scenarios";

const sign = (secret: string, timestamp: string, body: string) =>
  createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");

describe("verifyPhishingSignature", () => {
  it.each(SIGNATURE_CASES)(
    "returns $expected for $title",
    ({ tampering, verifiedAfterSeconds, expected }) => {
      const timestamp = String(SIGNED_AT_SECONDS);
      const signature = sign(SIGNING_SECRET, timestamp, SIGNED_BODY);
      const signed = { body: SIGNED_BODY, secret: SIGNING_SECRET, timestamp, signature };
      const verified = match(tampering)
        .with(SIGNATURE_TAMPERING.NONE, () => signed)
        .with(SIGNATURE_TAMPERING.DIFFERENT_BODY, () => ({ ...signed, body: "{}" }))
        .with(SIGNATURE_TAMPERING.WRONG_SECRET, () => ({
          ...signed,
          signature: sign("b".repeat(32), timestamp, SIGNED_BODY),
        }))
        .with(SIGNATURE_TAMPERING.MALFORMED_SIGNATURE, () => ({ ...signed, signature: "bad" }))
        .with(SIGNATURE_TAMPERING.MALFORMED_TIMESTAMP, () => ({
          ...signed,
          timestamp: `${timestamp}000`,
          signature: sign(SIGNING_SECRET, `${timestamp}000`, SIGNED_BODY),
        }))
        .with(SIGNATURE_TAMPERING.SHORT_SECRET, () => ({
          ...signed,
          secret: "short",
          signature: sign("short", timestamp, SIGNED_BODY),
        }))
        .exhaustive();

      expect(
        verifyPhishingSignature(
          Buffer.from(verified.body),
          verified.secret,
          verified.timestamp,
          verified.signature,
          (SIGNED_AT_SECONDS + verifiedAfterSeconds) * 1000,
        ),
      ).toBe(expected);
    },
  );
});
