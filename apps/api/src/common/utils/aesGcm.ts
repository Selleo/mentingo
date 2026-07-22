import crypto from "node:crypto";

const AES_GCM_ALGORITHM = "aes-256-gcm";
const AES_GCM_IV_LENGTH = 12;

export type AesGcmEncryptedValue = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function encryptWithAesGcm(key: Buffer, value: string | Buffer): AesGcmEncryptedValue {
  const iv = crypto.randomBytes(AES_GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_GCM_ALGORITHM, key, iv);
  const input = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);

  return {
    ciphertext,
    iv,
    authTag: cipher.getAuthTag(),
  };
}

export function decryptWithAesGcm(key: Buffer, encrypted: AesGcmEncryptedValue): Buffer {
  const decipher = crypto.createDecipheriv(AES_GCM_ALGORITHM, key, encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);

  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
}
