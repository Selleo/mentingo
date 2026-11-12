import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AUTH_ERROR_KEYS, AUTH_TOKEN_PURPOSE, SUPPORT_SESSION_ERROR_KEYS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { nanoid } from "nanoid";
import { authenticator } from "otplib";

import { UserSessionRevokedEvent } from "src/events/user/user-session-revoked.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SessionRevocationService } from "src/redis";
import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { jwtPayloadSchema, pendingMfaPayloadSchema } from "../schemas/jwt-strategy.schema";

import { MfaRepository } from "./mfa.repository";
import {
  AUTH_TOKEN_VERSION,
  CONSUME_MFA_CHALLENGE_SCRIPT,
  COUNT_MFA_ATTEMPT_SCRIPT,
  MFA_CHALLENGE_CONFIG,
  MFA_CHALLENGE_RESULT,
  SESSION_REDIS_KEY_PREFIXES,
} from "./session.constants";

import type {
  AuthContext,
  MfaChallenge,
  MfaChallengeIdentity,
  MfaAssuranceIdentity,
  MfaChallengeKeyOwner,
  SessionClaims,
  SupportMfaAssurance,
} from "./session.types";
import type { AuthSessionTokenPurpose } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class SessionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mfaRepository: MfaRepository,
    private readonly sessionRevocationService: SessionRevocationService,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  getUserMfaPolicy(tenantId: string, userId: string) {
    return this.mfaRepository.getUserMfaPolicy(tenantId, userId);
  }

  async verifySessionToken(
    token: string,
    purpose: AuthSessionTokenPurpose,
    allowMfa = false,
  ): Promise<SessionClaims> {
    const payload: unknown = await this.jwtService.verifyAsync(token, {
      secret: this.configService.getOrThrow<string>(
        purpose === AUTH_TOKEN_PURPOSE.REFRESH ? "jwt.refreshSecret" : "jwt.secret",
      ),
      algorithms: ["HS256"],
    });
    return this.validateSessionClaims(payload, purpose, allowMfa);
  }

  /**
   * Accepts a token only while its Redis session is active and MFA is satisfied. A pending MFA
   * token is accepted only where `allowMfa` is set, and never carries roles or permissions.
   */
  async validateSessionClaims(
    payload: unknown,
    purpose: AuthSessionTokenPurpose,
    allowMfa = false,
  ): Promise<SessionClaims> {
    const isPendingMfa = Value.Check(pendingMfaPayloadSchema, payload);

    if (!isPendingMfa && !Value.Check(jwtPayloadSchema, payload))
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    const claims = payload as SessionClaims;
    this.assertTokenUsableFor(claims, purpose, isPendingMfa);

    if (isPendingMfa) return this.validatePendingMfaClaims(claims, allowMfa);

    await this.sessionRevocationService.assertSessionActive(claims);

    if (claims.isSupportMode) return this.validateSupportModeClaims(claims);

    const policy = await this.getUserMfaPolicy(claims.tenantId, claims.userId);
    if (policy.required && !claims.mfaVerified && !allowMfa)
      throw new ForbiddenException(AUTH_ERROR_KEYS.MFA_REQUIRED);

    return claims;
  }

  /**
   * Re-checks a credential derived from a browser session (e.g. a SCORM content grant): the session
   * must still be active and the MFA assurance it was issued with must satisfy the current policy.
   */
  async assertDerivedSessionAssurance(actor: CurrentUserType): Promise<void> {
    await this.sessionRevocationService.assertSessionActive(actor);

    if (actor.isSupportMode) {
      await this.validateSupportModeClaims(actor);
      return;
    }

    await this.assertMfaAssurance(actor);
  }

  /** Rejects a credential issued without MFA once the owner's current policy requires MFA. */
  async assertMfaAssurance(identity: MfaAssuranceIdentity): Promise<void> {
    const policy = await this.getUserMfaPolicy(identity.tenantId, identity.userId);
    if (policy.required && !identity.mfaVerified)
      throw new ForbiddenException(AUTH_ERROR_KEYS.MFA_REQUIRED);
  }

  async storeSupportSessionMfaAssurance(
    sessionId: string,
    expiresAt: string,
    user: CurrentUserType,
  ) {
    await this.sessionRevocationService.assertSessionActive(user);

    const assurance: Partial<SupportMfaAssurance> = {
      userId: user.userId,
      sessionId: user.sessionId,
      sessionVersion: user.sessionVersion,
      mfaVerified: Boolean(user.mfaVerified),
    };
    const ttlSeconds = Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));

    await this.redisClient.set(
      this.getSupportAssuranceRedisKey(sessionId),
      JSON.stringify(assurance),
      { EX: ttlSeconds },
    );
  }

  async isSupportSessionMfaVerified(sessionId: string): Promise<boolean> {
    const storedAssurance = await this.redisClient.get(this.getSupportAssuranceRedisKey(sessionId));
    if (storedAssurance === null)
      throw new UnauthorizedException(SUPPORT_SESSION_ERROR_KEYS.SESSION_EXPIRED);

    const assurance = this.parseSupportAssurance(storedAssurance);
    await this.sessionRevocationService.assertSessionActive(assurance);

    return assurance.mfaVerified === true;
  }

  async createMfaChallenge(identity: MfaChallengeIdentity, context: AuthContext = {}) {
    const sessionVersion =
      context.sessionVersion ??
      (await this.sessionRevocationService.getOrCreateUserSessionVersion(identity.userId));
    await this.sessionRevocationService.assertUserSessionVersion(identity.userId, sessionVersion);

    const jti = nanoid(32);
    const challenge: MfaChallenge = {
      sessionVersion,
      userId: identity.userId,
      tenantId: identity.tenantId,
      email: identity.email,
      loginMethod: context.loginMethod,
      rememberMe: context.rememberMe ?? false,
    };

    await this.redisClient.set(
      this.getMfaChallengeRedisKey({ ...identity, jti }),
      JSON.stringify(challenge),
      { EX: MFA_CHALLENGE_CONFIG.TTL_SECONDS },
    );

    const accessToken = await this.jwtService.signAsync(
      {
        ...challenge,
        jti,
        tokenVersion: AUTH_TOKEN_VERSION,
        tokenPurpose: AUTH_TOKEN_PURPOSE.MFA,
        mfaVerified: false,
      },
      {
        secret: this.configService.getOrThrow<string>("jwt.secret"),
        expiresIn: MFA_CHALLENGE_CONFIG.TTL_SECONDS,
        algorithm: "HS256",
      },
    );

    return { accessToken, refreshToken: "", shouldVerifyMFA: true };
  }

  async getActiveMfaChallenge(user: CurrentUserType): Promise<MfaChallenge> {
    if (!this.isUnexpiredMfaToken(user))
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    const storedChallenge = await this.redisClient.get(this.getMfaChallengeRedisKey(user));
    if (!storedChallenge) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    const challenge = JSON.parse(storedChallenge) as MfaChallenge;
    if (challenge.tenantId !== user.tenantId || challenge.userId !== user.userId)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    return challenge;
  }

  async getOrCreateMfaEnrollmentSecret(user: CurrentUserType): Promise<string> {
    await this.getActiveMfaChallenge(user);

    const policy = await this.getUserMfaPolicy(user.tenantId, user.userId);
    if (policy.enabled) throw new ForbiddenException(AUTH_ERROR_KEYS.MFA_ALREADY_ENABLED);

    const secretKey = this.getMfaEnrollmentSecretRedisKey(user);
    await this.redisClient.set(secretKey, authenticator.generateSecret(), {
      NX: true,
      EX: this.getRemainingChallengeLifetimeSeconds(user),
    });

    const secret = await this.redisClient.get(secretKey);
    if (!secret) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    return secret;
  }

  /**
   * Verifies a TOTP code against the active challenge, enabling MFA on first enrollment. Attempts
   * are limited per account and per challenge, and each code time step can be used only once.
   */
  async verifyAndConsumeMfaChallenge(user: CurrentUserType, token: string): Promise<MfaChallenge> {
    const challenge = await this.getActiveMfaChallenge(user);
    await this.countMfaAttempt(user);

    if (!MFA_CHALLENGE_CONFIG.CODE_PATTERN.test(token))
      throw new BadRequestException(AUTH_ERROR_KEYS.INVALID_MFA_CODE);

    await this.mfaRepository.withLockedUserMfaSettings(
      user.tenantId,
      user.userId,
      async (settings, enableMfa) => {
        const enrollmentSecret = await this.redisClient.get(
          this.getMfaEnrollmentSecretRedisKey(user),
        );
        if (settings.isMFAEnabled && enrollmentSecret)
          throw new ForbiddenException(AUTH_ERROR_KEYS.MFA_ALREADY_ENABLED);

        const secret = settings.isMFAEnabled ? settings.MFASecret : enrollmentSecret;
        if (!secret) throw new BadRequestException(AUTH_ERROR_KEYS.INVALID_MFA_CODE);

        // A fixed epoch makes validation and the replay key refer to the same time step.
        const epoch = Date.now();
        const totp = authenticator.clone({
          epoch,
          window: 0,
          step: MFA_CHALLENGE_CONFIG.TOTP_STEP_SECONDS,
        });
        if (!totp.check(token, secret))
          throw new BadRequestException(AUTH_ERROR_KEYS.INVALID_MFA_CODE);

        await this.consumeMfaChallenge(user, epoch);

        if (!settings.isMFAEnabled) await enableMfa(secret);
      },
    );

    return challenge;
  }

  async revokeSupportSessionMfaAssurance(sessionId: string) {
    await this.redisClient.del(this.getSupportAssuranceRedisKey(sessionId));
  }

  async revokeSession(user: CurrentUserType) {
    await this.sessionRevocationService.revokeSession(user);
    if (user.supportSessionId) await this.revokeSupportSessionMfaAssurance(user.supportSessionId);
    if (user.sessionId) {
      const revokedSession = { userId: user.userId, sessionId: user.sessionId };

      await this.tenantDbRunnerService.runWithTenant(user.tenantId, () =>
        this.outboxPublisher.publish(new UserSessionRevokedEvent(revokedSession)),
      );
    }
  }

  async revokeMfaChallenge(user: CurrentUserType) {
    if (user.tokenPurpose !== AUTH_TOKEN_PURPOSE.MFA) return;

    await this.redisClient.del([
      this.getMfaChallengeRedisKey(user),
      this.getMfaEnrollmentSecretRedisKey(user),
      this.getMfaChallengeAttemptsRedisKey(user),
    ]);
  }

  private assertTokenUsableFor(
    claims: SessionClaims,
    purpose: AuthSessionTokenPurpose,
    isPendingMfa: boolean,
  ) {
    const isExpectedPurpose =
      claims.tokenPurpose === purpose || (purpose === AUTH_TOKEN_PURPOSE.ACCESS && isPendingMfa);

    if (
      claims.tokenVersion !== AUTH_TOKEN_VERSION ||
      claims.exp <= Date.now() / 1000 ||
      !isExpectedPurpose
    ) {
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);
    }
  }

  private async validatePendingMfaClaims(
    claims: SessionClaims,
    allowMfa: boolean,
  ): Promise<SessionClaims> {
    await this.sessionRevocationService.assertUserSessionVersion(
      claims.userId,
      claims.sessionVersion,
    );
    await this.getActiveMfaChallenge(claims);
    await this.getUserMfaPolicy(claims.tenantId, claims.userId);

    if (!allowMfa) throw new ForbiddenException(AUTH_ERROR_KEYS.MFA_REQUIRED);

    return { ...claims, permissions: [], roleSlugs: [] };
  }

  private async validateSupportModeClaims<T extends CurrentUserType>(claims: T): Promise<T> {
    if (
      !claims.supportSessionId ||
      !claims.originalTenantId ||
      !claims.originalUserId ||
      !claims.supportExpiresAt ||
      Date.parse(claims.supportExpiresAt) <= Date.now()
    ) {
      throw new UnauthorizedException(SUPPORT_SESSION_ERROR_KEYS.SESSION_EXPIRED);
    }

    const mfaVerified = await this.isSupportSessionMfaVerified(claims.supportSessionId);
    const operatorPolicy = await this.getUserMfaPolicy(
      claims.originalTenantId,
      claims.originalUserId,
    );

    if (operatorPolicy.required && !mfaVerified)
      throw new ForbiddenException({
        message: AUTH_ERROR_KEYS.MFA_REQUIRED,
        redirectUrl: claims.returnUrl,
      });

    return claims;
  }

  private parseSupportAssurance(storedAssurance: string): SupportMfaAssurance {
    try {
      return JSON.parse(storedAssurance) as SupportMfaAssurance;
    } catch {
      throw new UnauthorizedException(SUPPORT_SESSION_ERROR_KEYS.SESSION_EXPIRED);
    }
  }

  private isUnexpiredMfaToken(user: CurrentUserType) {
    return Boolean(
      user.tokenPurpose === AUTH_TOKEN_PURPOSE.MFA &&
        user.jti &&
        user.exp &&
        user.exp > Date.now() / 1000,
    );
  }

  private async countMfaAttempt(user: CurrentUserType) {
    const attempts = await this.redisClient.eval(COUNT_MFA_ATTEMPT_SCRIPT, {
      keys: [this.getMfaAccountAttemptsRedisKey(user), this.getMfaChallengeAttemptsRedisKey(user)],
      arguments: [
        String(MFA_CHALLENGE_CONFIG.ACCOUNT_ATTEMPT_WINDOW_SECONDS),
        String(this.getRemainingChallengeLifetimeSeconds(user)),
      ],
    });

    if (Number(attempts) > MFA_CHALLENGE_CONFIG.ATTEMPT_LIMIT)
      throw new HttpException(
        {
          message: "common.toast.tooManyRequests",
          retryAfterSeconds: MFA_CHALLENGE_CONFIG.RETRY_AFTER_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  private async consumeMfaChallenge(user: CurrentUserType, epoch: number) {
    const timeStep = Math.floor(epoch / (MFA_CHALLENGE_CONFIG.TOTP_STEP_SECONDS * 1000));
    const result = await this.redisClient.eval(CONSUME_MFA_CHALLENGE_SCRIPT, {
      keys: [
        this.getMfaChallengeRedisKey(user),
        this.getMfaUsedCodeRedisKey(user, timeStep),
        this.getMfaEnrollmentSecretRedisKey(user),
      ],
      arguments: [String(MFA_CHALLENGE_CONFIG.USED_CODE_TTL_SECONDS)],
    });

    if (result === MFA_CHALLENGE_RESULT.CODE_REUSED)
      throw new BadRequestException(AUTH_ERROR_KEYS.MFA_CODE_ALREADY_USED);
    if (result !== MFA_CHALLENGE_RESULT.CONSUMED)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);
  }

  private getRemainingChallengeLifetimeSeconds(user: CurrentUserType) {
    return Math.max(1, Math.ceil((user.exp ?? 0) - Date.now() / 1000));
  }

  private getMfaChallengeRedisKey({ tenantId, userId, jti }: MfaChallengeKeyOwner) {
    return `${SESSION_REDIS_KEY_PREFIXES.MFA_CHALLENGE}:${tenantId}:${userId}:${jti}`;
  }

  private getMfaEnrollmentSecretRedisKey(owner: MfaChallengeKeyOwner) {
    return `${this.getMfaChallengeRedisKey(owner)}:secret`;
  }

  private getMfaChallengeAttemptsRedisKey(owner: MfaChallengeKeyOwner) {
    return `${this.getMfaChallengeRedisKey(owner)}:attempts`;
  }

  private getMfaAccountAttemptsRedisKey({ tenantId, userId }: MfaChallengeKeyOwner) {
    return `${SESSION_REDIS_KEY_PREFIXES.MFA_ACCOUNT_ATTEMPTS}:${tenantId}:${userId}`;
  }

  private getMfaUsedCodeRedisKey({ tenantId, userId }: MfaChallengeKeyOwner, timeStep: number) {
    return `${SESSION_REDIS_KEY_PREFIXES.MFA_USED_CODE}:${tenantId}:${userId}:${timeStep}`;
  }

  private getSupportAssuranceRedisKey(sessionId: string) {
    return `${SESSION_REDIS_KEY_PREFIXES.SUPPORT_MFA_ASSURANCE}:${sessionId}`;
  }
}
