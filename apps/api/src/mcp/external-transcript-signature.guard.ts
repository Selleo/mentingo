import { createHash, createPublicKey, verify } from "node:crypto";

import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { McpRequest } from "./mcp.types";

/** Authenticates the bot independently of its participant's read-only OAuth grant. */
@Injectable()
export class ExternalTranscriptSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<McpRequest>>();
    try {
      const publicKeyValue = this.configService.get<string>(
        "EXTERNAL_TRANSCRIPT_SIGNING_PUBLIC_KEY",
      );
      const timestamp = request.headers["x-mentingo-transcript-timestamp"];
      const signatureValue = request.headers["x-mentingo-transcript-signature"];
      const authorization = request.headers.authorization;
      if (
        !publicKeyValue ||
        typeof timestamp !== "string" ||
        !/^\d{1,12}$/.test(timestamp) ||
        typeof signatureValue !== "string" ||
        !authorization?.startsWith("Bearer ") ||
        !Buffer.isBuffer(request.rawBody) ||
        !request.mcpActor
      ) {
        throw new Error("Missing signature input");
      }
      const seconds = Number(timestamp);
      if (Math.abs(Date.now() / 1000 - seconds) > 300) throw new Error("Expired signature");
      const publicKeyBytes = this.decodeBase64(publicKeyValue);
      const publicKey = createPublicKey({ key: publicKeyBytes, format: "der", type: "spki" });
      if (
        publicKey.asymmetricKeyType !== "ed25519" ||
        !publicKey.export({ format: "der", type: "spki" }).equals(publicKeyBytes)
      )
        throw new Error("Unsupported signature key");
      const signature = this.decodeBase64(signatureValue);
      if (signature.length !== 64) throw new Error("Invalid signature length");
      const signed = [
        "mentingo-external-transcript-v1",
        "POST",
        `${request.mcpActor.grant.resource}/external-conversations`,
        timestamp,
        createHash("sha256").update(request.rawBody).digest("hex"),
        createHash("sha256").update(authorization.slice("Bearer ".length)).digest("hex"),
      ].join("\n");
      if (
        request.method !== "POST" ||
        !verify(null, Buffer.from(signed, "utf8"), publicKey, signature)
      ) {
        throw new Error("Invalid signature");
      }
      return true;
    } catch {
      // A missing or invalid key disables only transcript ingestion, never app startup.
      throw new UnauthorizedException("Invalid external transcript signature");
    }
  }

  private decodeBase64(value: string): Buffer {
    const decoded = Buffer.from(value, "base64");
    if (!decoded.length || decoded.toString("base64") !== value) throw new Error("Invalid base64");
    return decoded;
  }
}
