import { createHmac } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SUPPORT_SESSION_STATUSES, TENANT_STATUSES } from "@repo/shared";
import { nanoid } from "nanoid";

import { SupportModeRepository } from "./support-mode.repository";

import type { CreateSupportSessionResult, SupportSession } from "./support-mode.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class SupportModeService {
  private static readonly GRANT_TTL_MS = 60 * 1000;
  private static readonly SESSION_TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly supportModeRepository: SupportModeRepository,
    private readonly configService: ConfigService,
  ) {}

  async createSupportSession(
    requestingUser: CurrentUserType,
    targetTenantId: string,
  ): Promise<CreateSupportSessionResult> {
    const [originalTenant, targetTenant] = await Promise.all([
      this.supportModeRepository.findTenantById(requestingUser.tenantId),
      this.supportModeRepository.findTenantById(targetTenantId),
    ]);

    if (!originalTenant || !targetTenant)
      throw new BadRequestException("superAdminTenants.error.notFound");

    if (requestingUser.tenantId === targetTenantId)
      throw new BadRequestException("superAdminTenants.error.currentTenantSupportNotAllowed");

    if (targetTenant.status !== TENANT_STATUSES.ACTIVE)
      throw new ForbiddenException("tenant.error.inactive");

    const grantToken = nanoid(64);
    const hashedGrantToken = this.hashGrant(grantToken);

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const grantTokenExpiresAt = new Date(now + SupportModeService.GRANT_TTL_MS).toISOString();
    const sessionExpiresAt = new Date(now + SupportModeService.SESSION_TTL_MS).toISOString();

    const returnUrl = `${originalTenant.host}/super-admin/tenants`;

    await this.supportModeRepository.revokeOtherActiveSessions(
      requestingUser.userId,
      targetTenantId,
      nowIso,
    );

    await this.supportModeRepository.createSupportSession({
      originalUserId: requestingUser.userId,
      originalTenantId: requestingUser.tenantId,
      targetTenantId,
      hashedGrantToken,
      grantExpiresAt: grantTokenExpiresAt,
      expiresAt: sessionExpiresAt,
      returnUrl,
      status: SUPPORT_SESSION_STATUSES.PENDING,
    });

    const redirectUrl = `${targetTenant.host}/api/auth/support/callback?grant=${encodeURIComponent(
      grantToken,
    )}`;

    return {
      redirectUrl,
      expiresAt: sessionExpiresAt,
    };
  }

  async consumeGrantToken(grantToken: string): Promise<SupportSession> {
    const hashedGrantToken = this.hashGrant(grantToken);
    const nowIso = new Date().toISOString();

    const activatedSession = await this.supportModeRepository.consumeGrantByHash(
      hashedGrantToken,
      nowIso,
    );

    if (!activatedSession) throw new UnauthorizedException("supportMode.errors.invalidGrant");

    return activatedSession;
  }

  async revokeSession(supportSessionId: string): Promise<void> {
    await this.supportModeRepository.revokeSession(supportSessionId, new Date().toISOString());
  }

  async assertActiveSession(supportSessionId: string): Promise<SupportSession> {
    const session = await this.supportModeRepository.findActiveSession(
      supportSessionId,
      new Date().toISOString(),
    );

    if (!session) throw new UnauthorizedException("supportMode.errors.sessionExpired");

    return session;
  }

  async closeExpiredSessions(): Promise<number> {
    return this.supportModeRepository.revokeExpiredSessions(new Date().toISOString());
  }

  private hashGrant(grantToken: string): string {
    const secret = this.configService.get<string>("jwt.secret");

    if (!secret) throw new UnauthorizedException("supportMode.errors.misconfiguredSecret");

    return createHmac("sha256", secret).update(grantToken, "utf8").digest("hex");
  }
}
