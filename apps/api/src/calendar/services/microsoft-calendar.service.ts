import crypto from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CALENDAR_PROVIDERS,
  MICROSOFT_CALENDAR_CONNECTION_STATUSES,
  MICROSOFT_CALENDAR_OUTBOUND_STATUSES,
  MICROSOFT_CALENDAR_PUBLIC_STATUSES,
} from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import {
  MANUAL_SYNC_COOLDOWN_MS,
  MICROSOFT_CALENDAR_LIFECYCLE_EVENTS,
  MICROSOFT_CALENDAR_OAUTH_PURPOSE,
  MICROSOFT_CALENDAR_SYNC_ERROR_CODES,
  MICROSOFT_CALENDAR_OAUTH_RESULTS,
  SUBSCRIPTION_LIFETIME_DAYS,
  SUBSCRIPTION_RENEWAL_WINDOW_MS,
  SYNC_HISTORY_DAYS,
  SYNC_HORIZON_MONTHS,
  WINDOW_REBUILD_AFTER_DAYS,
} from "../calendar.constants";
import {
  MicrosoftGraphApiClient,
  MicrosoftGraphError,
} from "../clients/microsoft-graph-api.client";
import { mapMicrosoftGraphEvent } from "../mappers/microsoft-calendar.mapper";
import { MicrosoftCalendarRepository } from "../repositories/microsoft-calendar.repository";
import {
  type MicrosoftCalendarConnection,
  type MicrosoftCalendarSyncReason,
  type MicrosoftGraphEvent,
  type MicrosoftGraphNotification,
  MICROSOFT_CALENDAR_SYNC_REASONS,
} from "../types/microsoft-calendar.types";

import { MicrosoftCalendarSyncQueueService } from "./microsoft-calendar-sync-queue.service";
import { MicrosoftCalendarTokenEncryptionService } from "./microsoft-calendar-token-encryption.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class MicrosoftCalendarService {
  constructor(
    private readonly microsoftCalendarRepository: MicrosoftCalendarRepository,
    private readonly microsoftGraphApiClient: MicrosoftGraphApiClient,
    private readonly microsoftCalendarTokenEncryptionService: MicrosoftCalendarTokenEncryptionService,
    private readonly microsoftCalendarSyncQueueService: MicrosoftCalendarSyncQueueService,
    private readonly tenantStateService: TenantStateService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async getConnection(currentUser: CurrentUserType) {
    const [available, connection] = await Promise.all([
      this.microsoftGraphApiClient.isConfigured(),
      this.microsoftCalendarRepository.getConnectionByUserId(currentUser.userId),
    ]);

    if (!connection) {
      return {
        available,
        status: MICROSOFT_CALENDAR_PUBLIC_STATUSES.DISCONNECTED,
        accountEmail: null,
        lastSuccessfulSyncAt: null,
        subscriptionExpiresAt: null,
        errorCode: null,
        stale: false,
        outboundSyncEnabled: false,
        outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.DISABLED,
        outboundCalendarId: null,
        outboundErrorCode: null,
        lastOutboundSyncAt: null,
      };
    }

    return {
      available,
      status: connection.status,
      accountEmail: connection.accountEmail,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      subscriptionExpiresAt: connection.subscriptionExpiresAt,
      errorCode: connection.errorCode,
      stale:
        connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.ERROR ||
        connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED,
      outboundSyncEnabled: connection.outboundSyncEnabled,
      outboundStatus: connection.outboundStatus,
      outboundCalendarId: connection.outboundCalendarId,
      outboundErrorCode: connection.outboundErrorCode,
      lastOutboundSyncAt: connection.lastOutboundSyncAt,
    };
  }

  async getAuthorizationUrl(currentUser: CurrentUserType, replace: boolean, outboundSync = false) {
    if (!(await this.microsoftGraphApiClient.isConfigured())) {
      throw new ForbiddenException("microsoftCalendar.errors.unavailable");
    }

    const origin = await resolveTenantOrigin(this.dbAdmin, currentUser.tenantId);

    const state = await this.tenantStateService.signMicrosoftCalendar({
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
      purpose: MICROSOFT_CALENDAR_OAUTH_PURPOSE,
      nonce: crypto.randomBytes(24).toString("base64url"),
      replace,
      outboundSync,
      origin,
    });

    return this.microsoftGraphApiClient.getAuthorizationUrl(state, this.getCallbackUrl(origin));
  }

  async completeAuthorization(input: { code: string; state: string }) {
    const state = await this.tenantStateService.verifyMicrosoftCalendar(input.state);
    if (!state) {
      throw new UnauthorizedException("microsoftCalendar.errors.invalidState");
    }

    const user = await this.microsoftCalendarRepository.getActiveUserById(state.userId);
    if (!user) {
      throw new UnauthorizedException("microsoftCalendar.errors.invalidState");
    }

    const token = await this.microsoftGraphApiClient.exchangeAuthorizationCode(
      input.code,
      this.getCallbackUrl(state.origin),
    );
    if (!token.refresh_token) {
      throw new UnauthorizedException("microsoftCalendar.errors.refreshTokenMissing");
    }

    const profile = await this.microsoftGraphApiClient.getProfile(token.access_token);
    const email = profile.mail || profile.userPrincipalName;
    const existing = await this.microsoftCalendarRepository.getConnectionByUserId(state.userId);

    if (existing && existing.accountId !== profile.id && !state.replace) {
      return {
        origin: state.origin,
        result: MICROSOFT_CALENDAR_OAUTH_RESULTS.REPLACEMENT_REQUIRED,
      };
    }

    if (existing && existing.accountId !== profile.id) {
      await this.disconnectConnection(existing);
    }

    const encryptedRefreshToken = this.microsoftCalendarTokenEncryptionService.encrypt(
      token.refresh_token,
    );

    const connection =
      existing && existing.accountId === profile.id
        ? await this.microsoftCalendarRepository.updateConnection(existing.id, {
            accountId: profile.id,
            accountEmail: email,
            ...encryptedRefreshToken,
            status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING,
            errorCode: null,
            syncCursor: null,
            windowBuiltAt: null,
            outboundSyncEnabled: state.outboundSync || existing.outboundSyncEnabled,
            outboundStatus:
              state.outboundSync || existing.outboundSyncEnabled
                ? MICROSOFT_CALENDAR_OUTBOUND_STATUSES.QUEUED
                : MICROSOFT_CALENDAR_OUTBOUND_STATUSES.DISABLED,
            outboundErrorCode: null,
          })
        : await this.microsoftCalendarRepository.createConnection({
            userId: state.userId,
            provider: CALENDAR_PROVIDERS.MICROSOFT,
            accountId: profile.id,
            accountEmail: email,
            encryptedRefreshToken,
          });

    if (!connection) throw new NotFoundException("microsoftCalendar.errors.connectionNotFound");

    await this.microsoftCalendarSyncQueueService.enqueue({
      tenantId: state.tenantId,
      connectionId: connection.id,
      fullSync: true,
      reason: MICROSOFT_CALENDAR_SYNC_REASONS.INITIAL,
    });

    if (connection.outboundSyncEnabled) {
      await this.microsoftCalendarSyncQueueService.enqueueOutbound({
        tenantId: state.tenantId,
        connectionId: connection.id,
        reason: MICROSOFT_CALENDAR_SYNC_REASONS.AUTHORIZATION,
      });
    }

    return { origin: state.origin, result: MICROSOFT_CALENDAR_OAUTH_RESULTS.CONNECTED };
  }

  async setOutboundSync(currentUser: CurrentUserType, enabled: boolean) {
    const connection = await this.microsoftCalendarRepository.getConnectionByUserId(
      currentUser.userId,
    );
    if (!connection) throw new NotFoundException("microsoftCalendar.errors.connectionNotFound");

    if (!enabled) {
      await this.microsoftCalendarRepository.updateConnection(connection.id, {
        outboundSyncEnabled: false,
        outboundStatus: MICROSOFT_CALENDAR_OUTBOUND_STATUSES.DISABLED,
        outboundErrorCode: null,
      });
      return { authorizationUrl: null };
    }

    if (!connection.outboundSyncEnabled) {
      return { authorizationUrl: await this.getAuthorizationUrl(currentUser, false, true) };
    }

    return { authorizationUrl: null };
  }

  async handleAuthorizationFailure(stateValue: string, error: unknown) {
    const state = await this.tenantStateService.verifyMicrosoftCalendar(stateValue);

    if (!state) return null;

    const adminConsentRequired =
      (error instanceof MicrosoftGraphError && error.adminConsentRequired) ||
      this.isAdminConsentError(error instanceof Error ? error.message : String(error ?? ""));

    const existing = await this.microsoftCalendarRepository.getConnectionByUserId(state.userId);

    if (existing) {
      await this.microsoftCalendarRepository.updateConnection(existing.id, {
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.ERROR,
        errorCode: adminConsentRequired
          ? MICROSOFT_CALENDAR_OAUTH_RESULTS.ADMIN_APPROVAL_REQUIRED
          : MICROSOFT_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
      });
    }

    return {
      origin: state.origin,
      result: adminConsentRequired
        ? MICROSOFT_CALENDAR_OAUTH_RESULTS.ADMIN_APPROVAL_REQUIRED
        : MICROSOFT_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
    };
  }

  async requestManualSync(currentUser: CurrentUserType) {
    const connection = await this.microsoftCalendarRepository.getConnectionByUserId(
      currentUser.userId,
    );

    if (!connection) throw new NotFoundException("microsoftCalendar.errors.connectionNotFound");

    if (connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED) {
      throw new ConflictException("microsoftCalendar.errors.reconnectRequired");
    }
    if (connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING) {
      throw new ConflictException("microsoftCalendar.errors.syncInProgress");
    }
    if (
      connection.lastSyncCompletedAt &&
      Date.now() - Date.parse(connection.lastSyncCompletedAt) < MANUAL_SYNC_COOLDOWN_MS
    ) {
      throw new ConflictException("microsoftCalendar.errors.syncCooldown");
    }

    await this.microsoftCalendarRepository.updateConnection(connection.id, {
      status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING,
      errorCode: null,
    });

    await this.microsoftCalendarSyncQueueService.enqueue({
      tenantId: currentUser.tenantId,
      connectionId: connection.id,
      fullSync: false,
      reason: MICROSOFT_CALENDAR_SYNC_REASONS.MANUAL,
    });

    if (connection.outboundSyncEnabled) {
      await this.microsoftCalendarSyncQueueService.enqueueOutbound({
        tenantId: currentUser.tenantId,
        connectionId: connection.id,
        reason: MICROSOFT_CALENDAR_SYNC_REASONS.MANUAL,
      });
    }
  }

  async disconnect(currentUser: CurrentUserType) {
    const connection = await this.microsoftCalendarRepository.getConnectionByUserId(
      currentUser.userId,
    );
    if (connection) await this.disconnectConnection(connection);
  }

  async disconnectUser(userId: UUIDType) {
    const connection = await this.microsoftCalendarRepository.getConnectionByUserId(userId);
    if (connection) await this.disconnectConnection(connection);
  }

  async disconnectUsers(userIds: UUIDType[]) {
    await Promise.all(userIds.map((userId) => this.disconnectUser(userId)));
  }

  async synchronizeConnection(
    connectionId: UUIDType,
    forceFullSync: boolean,
    reason: MicrosoftCalendarSyncReason = MICROSOFT_CALENDAR_SYNC_REASONS.RECONCILIATION,
  ) {
    const connection = await this.microsoftCalendarRepository.getConnectionById(connectionId);
    if (!connection) return;

    await this.microsoftCalendarRepository.updateConnection(connection.id, {
      status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING,
      errorCode: null,
    });

    try {
      const accessToken = await this.getAccessToken(connection);
      const { finalDeltaLink, seenEventIds, window, shouldRebuildWindow } =
        await this.syncDeltaPages(connection, accessToken, forceFullSync);

      if (!finalDeltaLink) throw new Error("Microsoft delta response did not include a delta link");
      if (shouldRebuildWindow) {
        await this.microsoftCalendarRepository.removeEventsMissingFromFullSync(
          connection.id,
          seenEventIds,
        );
      }

      const subscription = await this.ensureSubscription(connection, accessToken);
      const completedAt = new Date().toISOString();

      await this.microsoftCalendarRepository.updateConnection(connection.id, {
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.CONNECTED,
        errorCode: null,
        syncCursor: finalDeltaLink,
        syncWindowStart: window?.start ?? connection.syncWindowStart,
        syncWindowEnd: window?.end ?? connection.syncWindowEnd,
        windowBuiltAt: window ? completedAt : connection.windowBuiltAt,
        lastSuccessfulSyncAt: completedAt,
        ...(reason === MICROSOFT_CALENDAR_SYNC_REASONS.MANUAL
          ? { lastSyncCompletedAt: completedAt }
          : {}),
        ...subscription,
      });
    } catch (error) {
      const authenticationFailure = this.isAuthenticationFailure(error);
      await this.microsoftCalendarRepository.updateConnection(connection.id, {
        status: this.getSyncStatus(authenticationFailure),
        errorCode: this.getSyncFailure(error),
        ...(reason === MICROSOFT_CALENDAR_SYNC_REASONS.MANUAL
          ? { lastSyncCompletedAt: new Date().toISOString() }
          : {}),
      });
    }
  }

  private async syncDeltaPages(
    connection: MicrosoftCalendarConnection,
    accessToken: string,
    forceFullSync: boolean,
  ) {
    const shouldRebuildWindow = forceFullSync || this.shouldRebuildWindow(connection);
    const window = shouldRebuildWindow ? this.buildSyncWindow() : null;

    let nextUrl = shouldRebuildWindow
      ? this.microsoftGraphApiClient.buildInitialDeltaUrl(window!.start, window!.end)
      : connection.syncCursor;

    if (!nextUrl) {
      const fallbackWindow = this.buildSyncWindow();
      nextUrl = this.microsoftGraphApiClient.buildInitialDeltaUrl(
        fallbackWindow.start,
        fallbackWindow.end,
      );
    }

    const seenEventIds: string[] = [];
    let finalDeltaLink: string | undefined;

    while (nextUrl) {
      const page = await this.microsoftGraphApiClient.getDeltaPage(nextUrl, accessToken);
      await this.applyDeltaPage(connection, page.value, seenEventIds);
      finalDeltaLink = page["@odata.deltaLink"] ?? finalDeltaLink;
      nextUrl = page["@odata.nextLink"] ?? "";
    }

    return { finalDeltaLink, seenEventIds, window, shouldRebuildWindow };
  }

  async processNotification(notification: MicrosoftGraphNotification, lifecycle: boolean) {
    if (!notification.subscriptionId || !notification.clientState) return false;

    const connection = await this.microsoftCalendarRepository.getConnectionBySubscriptionId(
      notification.subscriptionId,
    );

    if (!connection) return false;

    if (!this.safeEqual(notification.clientState, connection.subscriptionClientState)) return false;

    await this.enqueueNotificationSync(connection, notification, lifecycle);
    return true;
  }

  private async enqueueNotificationSync(
    connection: MicrosoftCalendarConnection,
    notification: MicrosoftGraphNotification,
    lifecycle: boolean,
  ) {
    const fullSync =
      lifecycle &&
      (notification.lifecycleEvent === MICROSOFT_CALENDAR_LIFECYCLE_EVENTS.MISSED ||
        notification.lifecycleEvent === MICROSOFT_CALENDAR_LIFECYCLE_EVENTS.SUBSCRIPTION_REMOVED);

    await this.tenantDbRunnerService.runWithTenant(connection.tenantId, async () => {
      if (
        notification.lifecycleEvent === MICROSOFT_CALENDAR_LIFECYCLE_EVENTS.SUBSCRIPTION_REMOVED
      ) {
        await this.microsoftCalendarRepository.updateConnection(connection.id, {
          subscriptionId: null,
          subscriptionClientState: null,
          subscriptionExpiresAt: null,
        });
      }

      await this.microsoftCalendarSyncQueueService.enqueue({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        fullSync,
        reason: lifecycle
          ? MICROSOFT_CALENDAR_SYNC_REASONS.LIFECYCLE
          : MICROSOFT_CALENDAR_SYNC_REASONS.WEBHOOK,
      });
    });
  }

  private async applyDeltaPage(
    connection: MicrosoftCalendarConnection,
    graphEvents: MicrosoftGraphEvent[],
    seenEventIds: string[],
  ) {
    const removedIds: string[] = [];

    for (const graphEvent of graphEvents) {
      if (graphEvent["@removed"]) {
        removedIds.push(graphEvent.id);
        continue;
      }

      const event = mapMicrosoftGraphEvent(graphEvent);
      if (!event) continue;

      seenEventIds.push(event.externalEventId);
      await this.microsoftCalendarRepository.upsertEvent(connection.id, connection.userId, event);
    }

    await this.microsoftCalendarRepository.removeEvents(connection.id, removedIds);
  }

  private async getAccessToken(connection: MicrosoftCalendarConnection) {
    const refreshToken = this.microsoftCalendarTokenEncryptionService.decrypt(connection);
    const token = await this.microsoftGraphApiClient.refreshAccessToken(refreshToken);

    if (token.refresh_token && token.refresh_token !== refreshToken) {
      await this.microsoftCalendarRepository.updateConnection(
        connection.id,
        this.microsoftCalendarTokenEncryptionService.encrypt(token.refresh_token),
      );
    }

    return token.access_token;
  }

  private async ensureSubscription(connection: MicrosoftCalendarConnection, accessToken: string) {
    const expirationDateTime = this.getSubscriptionExpiration();
    const currentExpiration = connection.subscriptionExpiresAt
      ? Date.parse(connection.subscriptionExpiresAt)
      : 0;

    if (
      connection.subscriptionId &&
      currentExpiration - Date.now() > SUBSCRIPTION_RENEWAL_WINDOW_MS
    ) {
      return {};
    }

    if (connection.subscriptionId) {
      try {
        const subscription = await this.microsoftGraphApiClient.renewSubscription(
          accessToken,
          connection.subscriptionId,
          expirationDateTime,
        );
        return {
          subscriptionId: subscription.id,
          subscriptionExpiresAt: subscription.expirationDateTime,
        };
      } catch (error) {
        if (!(error instanceof MicrosoftGraphError) || error.statusCode !== 404) throw error;
      }
    }

    return this.createSubscription(connection, accessToken, expirationDateTime);
  }

  private async createSubscription(
    connection: MicrosoftCalendarConnection,
    accessToken: string,
    expirationDateTime: string,
  ) {
    const origin = await resolveTenantOrigin(this.dbAdmin, connection.tenantId);

    const clientState = crypto.randomBytes(32).toString("base64url");

    const subscription = await this.microsoftGraphApiClient.createSubscription(
      accessToken,
      `${origin}/api/calendar/microsoft/notifications`,
      `${origin}/api/calendar/microsoft/lifecycle-notifications`,
      clientState,
      expirationDateTime,
    );

    return {
      subscriptionId: subscription.id,
      subscriptionClientState: clientState,
      subscriptionExpiresAt: subscription.expirationDateTime,
    };
  }

  private async disconnectConnection(connection: MicrosoftCalendarConnection) {
    try {
      if (connection.subscriptionId) {
        const accessToken = await this.getAccessToken(connection);
        await this.microsoftGraphApiClient.deleteSubscription(
          accessToken,
          connection.subscriptionId,
        );
      }
    } catch (error) {
      // The local connection must still be removed when the remote subscription is already gone
      // or Microsoft Graph is temporarily unavailable.
    }
    await this.microsoftCalendarRepository.deleteConnectionAndEvents(connection.id);
  }

  private shouldRebuildWindow(connection: MicrosoftCalendarConnection) {
    if (!connection.syncCursor || !connection.windowBuiltAt) return true;
    return (
      Date.now() - Date.parse(connection.windowBuiltAt) >= WINDOW_REBUILD_AFTER_DAYS * 86_400_000
    );
  }

  private buildSyncWindow() {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - SYNC_HISTORY_DAYS);
    const end = new Date(now);
    end.setUTCMonth(end.getUTCMonth() + SYNC_HORIZON_MONTHS);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  private getSubscriptionExpiration() {
    const expiration = new Date();
    expiration.setUTCDate(expiration.getUTCDate() + SUBSCRIPTION_LIFETIME_DAYS);
    return expiration.toISOString();
  }

  private getCallbackUrl(origin: string) {
    return `${origin.replace(/\/$/, "")}/api/auth/microsoft-calendar/callback`;
  }

  private safeEqual(provided: string, expected: string | null) {
    if (!expected) return false;

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    return (
      providedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  private isAdminConsentError(error: string | undefined) {
    const normalized = error?.toLowerCase() ?? "";

    return (
      normalized.includes("admin_consent") ||
      normalized.includes("consent_required") ||
      normalized.includes("admin approval") ||
      normalized.includes("aadsts65001") ||
      normalized.includes("aadsts90094")
    );
  }

  private getSyncFailure(error: unknown) {
    if (error instanceof MicrosoftGraphError && error.adminConsentRequired) {
      return MICROSOFT_CALENDAR_OAUTH_RESULTS.ADMIN_APPROVAL_REQUIRED;
    }

    if (error instanceof MicrosoftGraphError && error.authenticationFailure) {
      return MICROSOFT_CALENDAR_SYNC_ERROR_CODES.AUTHORIZATION_EXPIRED;
    }

    return MICROSOFT_CALENDAR_SYNC_ERROR_CODES.SYNC_FAILED;
  }

  private isAuthenticationFailure(error: unknown) {
    return error instanceof MicrosoftGraphError && error.authenticationFailure;
  }

  private getSyncStatus(authenticationFailure: boolean) {
    if (authenticationFailure) return MICROSOFT_CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED;

    return MICROSOFT_CALENDAR_CONNECTION_STATUSES.ERROR;
  }
}
