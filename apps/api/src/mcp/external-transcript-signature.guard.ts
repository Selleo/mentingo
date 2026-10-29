import { createHash, createPublicKey, verify } from "node:crypto";

import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { McpResourceService } from "./mcp-resource.service";

import type { ExternalConversationRequest } from "./external-conversations.types";

@Injectable()
export class ExternalTranscriptSignatureGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly mcpResourceService: McpResourceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<ExternalConversationRequest>>();

    try {
      const publicKeyValue = this.configService.get<string>(
        "EXTERNAL_TRANSCRIPT_SIGNING_PUBLIC_KEY",
      );
      const timestamp = request.headers["x-mentingo-transcript-timestamp"];
      const signatureValue = request.headers["x-mentingo-transcript-signature"];

      if (
        !publicKeyValue ||
        typeof timestamp !== "string" ||
        !/^\d{1,12}$/.test(timestamp) ||
        typeof signatureValue !== "string" ||
        !Buffer.isBuffer(request.rawBody)
      ) {
        throw new Error("Missing signature input");
      }

      const seconds = Number(timestamp);

      if (Math.abs(Date.now() / 1000 - seconds) > 300) {
        throw new Error("Expired signature");
      }

      const publicKey = this.createVerificationKey(publicKeyValue);
      const signature = this.decodeBase64(signatureValue);

      if (signature.length !== 64) {
        throw new Error("Invalid signature length");
      }

      const resource = await this.mcpResourceService.fromRequest(request);
      const signed = [
        "mentingo-external-transcript-v1",
        "POST",
        `${resource.url}/external-conversations`,
        timestamp,
        createHash("sha256").update(request.rawBody).digest("hex"),
      ].join("\n");

      if (
        request.method !== "POST" ||
        !verify(null, Buffer.from(signed, "utf8"), publicKey, signature)
      ) {
        throw new Error("Invalid signature");
      }

      request.externalConversationResource = resource;

      return true;
    } catch {
      throw new UnauthorizedException("Invalid external transcript signature");
    }
  }

  private createVerificationKey(value: string) {
    const bytes = this.decodeBase64(value);
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" });

    if (
      key.asymmetricKeyType !== "ed25519" ||
      !key.export({ format: "der", type: "spki" }).equals(bytes)
    ) {
      throw new Error("Unsupported signature key");
    }

    return key;
  }

  private decodeBase64(value: string): Buffer {
    const decoded = Buffer.from(value, "base64");

    if (!decoded.length || decoded.toString("base64") !== value) {
      throw new Error("Invalid base64");
    }

    return decoded;
  }
}
