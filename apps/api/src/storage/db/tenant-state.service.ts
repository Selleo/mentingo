import crypto from "crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";

type TenantStatePayload = {
  tenantId: string;
  iat: number;
  exp: number;
};

@Injectable()
export class TenantStateService {
  private readonly STATE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {}

  async sign(tenantId: string): Promise<string> {
    const now = Date.now();

    const payload: TenantStatePayload = {
      tenantId,
      iat: now,
      exp: now + this.STATE_TTL_MS,
    };

    const body = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.base64UrlEncode(await this.hashHmac(body));

    return `${body}.${signature}`;
  }

  async verify(state: string): Promise<string | null> {
    const [body, signature] = state.split(".");

    if (!body || !signature) return null;

    const expectedSig = this.base64UrlEncode(await this.hashHmac(body));
    if (!this.timingSafeEqual(signature, expectedSig)) return null;

    const payload = this.safeParsePayload(body);
    if (!payload) return null;

    if (payload.exp < Date.now()) return null;

    return payload.tenantId;
  }

  private async getSecret(): Promise<string> {
    const secret = this.configService.get<string>("jwt.secret");

    if (!secret) throw new UnauthorizedException("Tenant state secret is not configured");

    return secret;
  }

  private async hashHmac(input: string): Promise<Buffer> {
    const secret = await this.getSecret();

    return crypto.createHmac("sha256", secret).update(input).digest();
  }

  private base64UrlEncode(value: string | Buffer): string {
    const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  private safeParsePayload(body: string): TenantStatePayload | null {
    try {
      const json = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      );
      const payload = JSON.parse(json) as TenantStatePayload;

      if (!payload?.tenantId || !payload?.iat || !payload?.exp) return null;

      return payload;
    } catch {
      return null;
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
