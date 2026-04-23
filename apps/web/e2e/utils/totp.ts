import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (value: string) => {
  const cleaned = value
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index < 0) continue;

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
};

export const generateTotpToken = (secret: string, timestamp = Date.now()) => {
  const period = 30;
  const digits = 6;
  const counter = Math.floor(timestamp / 1000 / period);
  const key = base32Decode(secret);
  const challenge = Buffer.alloc(8);

  challenge.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(challenge).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** digits).padStart(digits, "0");
};
