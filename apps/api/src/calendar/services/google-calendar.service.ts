import crypto from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CALENDAR_CONNECTION_PUBLIC_STATUSES,
  CALENDAR_CONNECTION_STATUSES,
  CALENDAR_OUTBOUND_STATUSES,
  CALENDAR_PROVIDERS,
  GOOGLE_CALENDAR_OAUTH_RESULTS,
} from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import {
  CALENDAR_SYNC_ERROR_CODES,
  GOOGLE_CALENDAR_OAUTH_PURPOSE,
  GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
  GOOGLE_CALENDAR_RESOURCE_STATES,
  MANUAL_SYNC_COOLDOWN_MS,
  SUBSCRIPTION_RENEWAL_WINDOW_MS,
} from "../calendar.constants";
import {
  GOOGLE_CALENDAR_REQUIRED_SCOPES,
  GoogleCalendarApiClient,
  GoogleCalendarApiError,
} from "../clients/google-calendar-api.client";
import {
  isGoogleCalendarEventRemoved,
  mapGoogleCalendarEvent,
} from "../mappers/google-calendar.mapper";
import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";
import {
  GOOGLE_CALENDAR_SYNC_REASONS,
  type GoogleCalendarDeltaSyncResult,
  type GoogleCalendarEvent,
  type GoogleCalendarNotification,
  type GoogleCalendarSubscription,
  type GoogleCalendarSyncReason,
} from "../types/google-calendar.types";
import {
  buildCalendarSyncWindow,
  getCalendarSubscriptionExpiration,
  isCalendarSyncWindowOutdated,
  isEventOutsideSyncWindow,
  isTimingSafeEqual,
} from "../utils/calendar-sync.utils";

import { CalendarTokenEncryptionService } from "./calendar-token-encryption.service";
import { GoogleCalendarAccessTokenService } from "./google-calendar-access-token.service";
import { GoogleCalendarSyncQueueService } from "./google-calendar-sync-queue.service";

import type { CalendarConnection } from "../types/calendar-connection.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly googleCalendarApiClient: GoogleCalendarApiClient,
    private readonly googleCalendarAccessTokenService: GoogleCalendarAccessTokenService,
    private readonly calendarTokenEncryptionService: CalendarTokenEncryptionService,
    private readonly googleCalendarSyncQueueService: GoogleCalendarSyncQueueService,
    private readonly tenantStateService: TenantStateService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async getConnection(currentUser: CurrentUserType) {
    const [available, connection] = await Promise.all([
      this.googleCalendarApiClient.isConfigured(),
      this.getUserConnection(currentUser.userId),
    ]);

    if (!connection) {
      return {
        available,
        status: CALENDAR_CONNECTION_PUBLIC_STATUSES.DISCONNECTED,
        accountEmail: null,
        lastSuccessfulSyncAt: null,
        subscriptionExpiresAt: null,
        errorCode: null,
        stale: false,
        outboundSyncEnabled: false,
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
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
        connection.status === CALENDAR_CONNECTION_STATUSES.ERROR ||
        connection.status === CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED,
      outboundSyncEnabled: connection.outboundSyncEnabled,
      outboundStatus: connection.outboundStatus,
      outboundCalendarId: connection.outboundCalendarId,
      outboundErrorCode: connection.outboundErrorCode,
      lastOutboundSyncAt: connection.lastOutboundSyncAt,
    };
  }

  async getAuthorizationUrl(currentUser: CurrentUserType, replace: boolean, outboundSync = false) {
    if (!(await this.googleCalendarApiClient.isConfigured())) {
      throw new ForbiddenException("googleCalendar.errors.unavailable");
    }

    const origin = await resolveTenantOrigin(this.dbAdmin, currentUser.tenantId);

    const state = await this.tenantStateService.signGoogleCalendar({
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
      purpose: GOOGLE_CALENDAR_OAUTH_PURPOSE,
      nonce: crypto.randomBytes(24).toString("base64url"),
      replace,
      outboundSync,
      origin,
    });

    return this.googleCalendarApiClient.getAuthorizationUrl(state, this.getCallbackUrl(origin));
  }

  async completeAuthorization(input: { code: string; state: string }) {
    const state = await this.tenantStateService.verifyGoogleCalendar(input.state);
    if (!state) throw new UnauthorizedException("googleCalendar.errors.invalidState");

    const user = await this.calendarConnectionRepository.getActiveUserById(state.userId);
    if (!user) throw new UnauthorizedException("googleCalendar.errors.invalidState");

    const token = await this.googleCalendarApiClient.exchangeAuthorizationCode(
      input.code,
      this.getCallbackUrl(state.origin),
    );

    if (!this.hasRequiredScopes(token.scope)) {
      return { origin: state.origin, result: GOOGLE_CALENDAR_OAUTH_RESULTS.PERMISSIONS_MISSING };
    }

    if (!token.refresh_token) {
      throw new UnauthorizedException("googleCalendar.errors.refreshTokenMissing");
    }

    const profile = await this.googleCalendarApiClient.getProfile(token.access_token);
    const existing = await this.getUserConnection(state.userId);
    const isSameAccount = existing?.accountId === profile.sub;

    if (existing && !isSameAccount && !state.replace) {
      return { origin: state.origin, result: GOOGLE_CALENDAR_OAUTH_RESULTS.REPLACEMENT_REQUIRED };
    }

    if (existing && !isSameAccount) await this.disconnectConnection(existing);

    const encryptedRefreshToken = this.calendarTokenEncryptionService.encrypt(token.refresh_token);
    const outboundSyncEnabled = Boolean(state.outboundSync || existing?.outboundSyncEnabled);

    const connection =
      existing && isSameAccount
        ? await this.calendarConnectionRepository.updateConnection(existing.id, {
            accountEmail: profile.email,
            ...encryptedRefreshToken,
            status: CALENDAR_CONNECTION_STATUSES.SYNCING,
            errorCode: null,
            syncCursor: null,
            windowBuiltAt: null,
            outboundSyncEnabled,
            outboundStatus: outboundSyncEnabled
              ? CALENDAR_OUTBOUND_STATUSES.QUEUED
              : CALENDAR_OUTBOUND_STATUSES.DISABLED,
            outboundErrorCode: null,
          })
        : await this.calendarConnectionRepository.createConnection({
            userId: state.userId,
            provider: CALENDAR_PROVIDERS.GOOGLE,
            accountId: profile.sub,
            accountEmail: profile.email,
            encryptedRefreshToken,
          });

    if (!connection) throw new NotFoundException("googleCalendar.errors.connectionNotFound");

    if (state.outboundSync && !connection.outboundSyncEnabled) {
      await this.calendarConnectionRepository.updateConnection(connection.id, {
        outboundSyncEnabled: true,
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.QUEUED,
      });
    }

    await this.googleCalendarSyncQueueService.enqueueInboundSync({
      tenantId: state.tenantId,
      connectionId: connection.id,
      fullSync: true,
      reason: GOOGLE_CALENDAR_SYNC_REASONS.INITIAL,
    });

    if (outboundSyncEnabled) {
      await this.googleCalendarSyncQueueService.enqueueOutboundSync({
        tenantId: state.tenantId,
        connectionId: connection.id,
        reason: GOOGLE_CALENDAR_SYNC_REASONS.AUTHORIZATION,
      });
    }

    return { origin: state.origin, result: GOOGLE_CALENDAR_OAUTH_RESULTS.CONNECTED };
  }

  async handleAuthorizationFailure(stateValue: string) {
    const state = await this.tenantStateService.verifyGoogleCalendar(stateValue);
    if (!state) return null;

    const existing = await this.getUserConnection(state.userId);

    if (existing) {
      await this.calendarConnectionRepository.updateConnection(existing.id, {
        status: CALENDAR_CONNECTION_STATUSES.ERROR,
        errorCode: GOOGLE_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
      });
    }

    return { origin: state.origin, result: GOOGLE_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED };
  }

  async setOutboundSync(currentUser: CurrentUserType, enabled: boolean) {
    const connection = await this.getUserConnection(currentUser.userId);
    if (!connection) throw new NotFoundException("googleCalendar.errors.connectionNotFound");

    if (!enabled) {
      await this.calendarConnectionRepository.updateConnection(connection.id, {
        outboundSyncEnabled: false,
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
        outboundErrorCode: null,
      });
      return { authorizationUrl: null };
    }

    if (connection.status === CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED) {
      return { authorizationUrl: await this.getAuthorizationUrl(currentUser, false, true) };
    }

    if (!connection.outboundSyncEnabled) {
      await this.calendarConnectionRepository.updateConnection(connection.id, {
        outboundSyncEnabled: true,
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.QUEUED,
        outboundErrorCode: null,
      });

      await this.googleCalendarSyncQueueService.enqueueOutboundSync({
        tenantId: currentUser.tenantId,
        connectionId: connection.id,
        reason: GOOGLE_CALENDAR_SYNC_REASONS.MANUAL,
      });
    }

    return { authorizationUrl: null };
  }

  async requestManualSync(currentUser: CurrentUserType) {
    const connection = await this.getUserConnection(currentUser.userId);
    if (!connection) throw new NotFoundException("googleCalendar.errors.connectionNotFound");

    if (connection.status === CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED) {
      throw new ConflictException("googleCalendar.errors.reconnectRequired");
    }
    if (connection.status === CALENDAR_CONNECTION_STATUSES.SYNCING) {
      throw new ConflictException("googleCalendar.errors.syncInProgress");
    }
    if (
      connection.lastSyncCompletedAt &&
      Date.now() - Date.parse(connection.lastSyncCompletedAt) < MANUAL_SYNC_COOLDOWN_MS
    ) {
      throw new ConflictException("googleCalendar.errors.syncCooldown");
    }

    await this.calendarConnectionRepository.updateConnection(connection.id, {
      status: CALENDAR_CONNECTION_STATUSES.SYNCING,
      errorCode: null,
    });

    await this.googleCalendarSyncQueueService.enqueueInboundSync({
      tenantId: currentUser.tenantId,
      connectionId: connection.id,
      fullSync: false,
      reason: GOOGLE_CALENDAR_SYNC_REASONS.MANUAL,
    });

    if (connection.outboundSyncEnabled) {
      await this.googleCalendarSyncQueueService.enqueueOutboundSync({
        tenantId: currentUser.tenantId,
        connectionId: connection.id,
        reason: GOOGLE_CALENDAR_SYNC_REASONS.MANUAL,
      });
    }
  }

  async disconnect(currentUser: CurrentUserType) {
    await this.disconnectUser(currentUser.userId);
  }

  async disconnectUser(userId: UUIDType) {
    const connection = await this.getUserConnection(userId);
    if (connection) await this.disconnectConnection(connection);
  }

  async disconnectUsers(userIds: UUIDType[]) {
    await Promise.all(userIds.map((userId) => this.disconnectUser(userId)));
  }

  async synchronizeConnection(
    connectionId: UUIDType,
    forceFullSync: boolean,
    reason: GoogleCalendarSyncReason = GOOGLE_CALENDAR_SYNC_REASONS.RECONCILIATION,
  ) {
    const connection = await this.calendarConnectionRepository.getConnectionById(connectionId);
    if (!connection || connection.provider !== CALENDAR_PROVIDERS.GOOGLE) return;

    await this.calendarConnectionRepository.updateConnection(connection.id, {
      status: CALENDAR_CONNECTION_STATUSES.SYNCING,
      errorCode: null,
    });

    const manualSyncCompletion =
      reason === GOOGLE_CALENDAR_SYNC_REASONS.MANUAL
        ? { lastSyncCompletedAt: new Date().toISOString() }
        : {};

    try {
      const accessToken = await this.googleCalendarAccessTokenService.getAccessToken(connection);
      const { nextSyncToken, seenEventIds, window } = await this.synchronizeEvents(
        connection,
        accessToken,
        forceFullSync,
      );

      if (window) {
        await this.calendarConnectionRepository.removeEventsMissingFromFullSync(
          connection.id,
          seenEventIds,
        );
      }

      const subscription = await this.ensureSubscription(connection, accessToken);
      const completedAt = new Date().toISOString();

      await this.calendarConnectionRepository.updateConnection(connection.id, {
        status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
        errorCode: null,
        syncCursor: nextSyncToken,
        syncWindowStart: window?.start ?? connection.syncWindowStart,
        syncWindowEnd: window?.end ?? connection.syncWindowEnd,
        windowBuiltAt: window ? completedAt : connection.windowBuiltAt,
        lastSuccessfulSyncAt: completedAt,
        ...manualSyncCompletion,
        ...subscription,
      });
    } catch (error) {
      const authenticationFailure =
        error instanceof GoogleCalendarApiError && error.authenticationFailure;

      await this.calendarConnectionRepository.updateConnection(connection.id, {
        status: authenticationFailure
          ? CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED
          : CALENDAR_CONNECTION_STATUSES.ERROR,
        errorCode: authenticationFailure
          ? CALENDAR_SYNC_ERROR_CODES.AUTHORIZATION_EXPIRED
          : CALENDAR_SYNC_ERROR_CODES.SYNC_FAILED,
        ...manualSyncCompletion,
      });
    }
  }

  async processNotification(notification: GoogleCalendarNotification) {
    if (!notification.channelId || !notification.channelToken) return false;

    const connection = await this.calendarConnectionRepository.getConnectionBySubscriptionId(
      notification.channelId,
      CALENDAR_PROVIDERS.GOOGLE,
    );
    if (!connection) return false;

    if (!isTimingSafeEqual(notification.channelToken, connection.subscriptionClientState)) {
      return false;
    }

    if (notification.resourceState === GOOGLE_CALENDAR_RESOURCE_STATES.SYNC) return true;

    await this.tenantDbRunnerService.runWithTenant(connection.tenantId, () =>
      this.googleCalendarSyncQueueService.enqueueInboundSync({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        fullSync: false,
        reason: GOOGLE_CALENDAR_SYNC_REASONS.WEBHOOK,
      }),
    );

    return true;
  }

  private async synchronizeEvents(
    connection: CalendarConnection,
    accessToken: string,
    forceFullSync: boolean,
  ): Promise<GoogleCalendarDeltaSyncResult> {
    if (forceFullSync || isCalendarSyncWindowOutdated(connection) || !connection.syncCursor) {
      return this.synchronizeFullWindow(connection, accessToken);
    }

    try {
      return await this.synchronizeIncrementalChanges(
        connection,
        accessToken,
        connection.syncCursor,
      );
    } catch (error) {
      if (!(error instanceof GoogleCalendarApiError) || !error.syncTokenExpired) throw error;

      return this.synchronizeFullWindow(connection, accessToken);
    }
  }

  private async synchronizeFullWindow(
    connection: CalendarConnection,
    accessToken: string,
  ): Promise<GoogleCalendarDeltaSyncResult> {
    const window = buildCalendarSyncWindow();
    const seenEventIds: string[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const page = await this.googleCalendarApiClient.getEventsPage(
        accessToken,
        GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
        { timeMin: window.start, timeMax: window.end, ...(pageToken ? { pageToken } : {}) },
      );

      await this.storeEventsPage(connection, page.items ?? [], page.timeZone, window, seenEventIds);
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) throw new Error("Google Calendar response did not include a sync token");

    return { nextSyncToken, seenEventIds, window };
  }

  private async synchronizeIncrementalChanges(
    connection: CalendarConnection,
    accessToken: string,
    syncToken: string,
  ): Promise<GoogleCalendarDeltaSyncResult> {
    const window = { start: connection.syncWindowStart, end: connection.syncWindowEnd };
    const seenEventIds: string[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const page = await this.googleCalendarApiClient.getEventsPage(
        accessToken,
        GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
        { syncToken, ...(pageToken ? { pageToken } : {}) },
      );

      await this.storeEventsPage(connection, page.items ?? [], page.timeZone, window, seenEventIds);
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) throw new Error("Google Calendar response did not include a sync token");

    return { nextSyncToken, seenEventIds, window: null };
  }

  private async storeEventsPage(
    connection: CalendarConnection,
    googleEvents: GoogleCalendarEvent[],
    calendarTimezone: string | undefined,
    window: { start: string | null; end: string | null },
    seenEventIds: string[],
  ) {
    const removedEventIds: string[] = [];

    for (const googleEvent of googleEvents) {
      if (isGoogleCalendarEventRemoved(googleEvent)) {
        removedEventIds.push(googleEvent.id);
        continue;
      }

      const event = mapGoogleCalendarEvent(googleEvent, calendarTimezone ?? "UTC");
      if (!event) continue;

      if (isEventOutsideSyncWindow(event, window)) {
        removedEventIds.push(event.externalEventId);
        continue;
      }

      seenEventIds.push(event.externalEventId);
      await this.calendarConnectionRepository.upsertEvent(connection, event);
    }

    await this.calendarConnectionRepository.removeEvents(connection.id, removedEventIds);
  }

  private async ensureSubscription(
    connection: CalendarConnection,
    accessToken: string,
  ): Promise<Partial<GoogleCalendarSubscription>> {
    const currentExpiration = connection.subscriptionExpiresAt
      ? Date.parse(connection.subscriptionExpiresAt)
      : 0;

    if (
      connection.subscriptionId &&
      currentExpiration - Date.now() > SUBSCRIPTION_RENEWAL_WINDOW_MS
    ) {
      return {};
    }

    try {
      const subscription = await this.createSubscription(connection, accessToken);
      await this.stopSubscription(connection, accessToken);
      return subscription;
    } catch (error) {
      // Push notifications only speed synchronization up; scheduled reconciliation still keeps
      // the calendar current, so a rejected channel (for example a non-HTTPS origin) is not fatal.
      this.logger.warn(
        `Google Calendar push channel could not be created for connection ${connection.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {};
    }
  }

  private async createSubscription(
    connection: CalendarConnection,
    accessToken: string,
  ): Promise<GoogleCalendarSubscription> {
    const origin = await resolveTenantOrigin(this.dbAdmin, connection.tenantId);
    const channelToken = crypto.randomBytes(32).toString("base64url");

    const channel = await this.googleCalendarApiClient.watchEvents(
      accessToken,
      GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID,
      {
        channelId: crypto.randomUUID(),
        address: `${origin.replace(/\/$/, "")}/api/calendar/google/notifications`,
        token: channelToken,
        expiresAt: getCalendarSubscriptionExpiration(),
      },
    );

    return {
      subscriptionId: channel.id,
      subscriptionResourceId: channel.resourceId,
      subscriptionClientState: channelToken,
      subscriptionExpiresAt: channel.expiration
        ? new Date(Number(channel.expiration)).toISOString()
        : getCalendarSubscriptionExpiration(),
    };
  }

  private async stopSubscription(connection: CalendarConnection, accessToken: string) {
    if (!connection.subscriptionId || !connection.subscriptionResourceId) return;

    try {
      await this.googleCalendarApiClient.stopChannel(
        accessToken,
        connection.subscriptionId,
        connection.subscriptionResourceId,
      );
    } catch {
      // An expired or already removed channel cannot deliver notifications anymore.
    }
  }

  private async disconnectConnection(connection: CalendarConnection) {
    try {
      if (connection.subscriptionId) {
        const accessToken = await this.googleCalendarAccessTokenService.getAccessToken(connection);
        await this.stopSubscription(connection, accessToken);
      }
    } catch {
      // The local connection must still be removed when Google is unavailable or the
      // authorization was already revoked.
    }

    await this.calendarConnectionRepository.deleteConnectionAndEvents(connection.id);
  }

  private getUserConnection(userId: UUIDType) {
    return this.calendarConnectionRepository.getConnectionByUserId(
      userId,
      CALENDAR_PROVIDERS.GOOGLE,
    );
  }

  private hasRequiredScopes(grantedScope: string | undefined) {
    const grantedScopes = new Set(grantedScope?.split(" ") ?? []);
    return GOOGLE_CALENDAR_REQUIRED_SCOPES.every((scope) => grantedScopes.has(scope));
  }

  private getCallbackUrl(origin: string) {
    return `${origin.replace(/\/$/, "")}/api/auth/google-calendar/callback`;
  }
}
