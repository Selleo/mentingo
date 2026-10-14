export interface BunnyWebhookSignature {
  rawBody: Buffer;
  signature?: string;
  signatureVersion?: string;
  signatureAlgorithm?: string;
}
