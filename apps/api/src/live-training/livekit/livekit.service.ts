import { createHash } from "crypto";

import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  TwirpError,
  WebhookReceiver,
  type ParticipantInfo,
  type Room,
  type VideoGrant,
} from "livekit-server-sdk";

import { EnvService } from "src/env/services/env.service";

import {
  LIVEKIT_DEFAULT_ROOM_DEPARTURE_TIMEOUT_SECONDS,
  LIVEKIT_DEFAULT_ROOM_EMPTY_TIMEOUT_SECONDS,
  LIVEKIT_DEFAULT_TOKEN_TTL_SECONDS,
} from "./livekit.constants";

import type {
  CreateLiveKitParticipantTokenInput,
  CreateLiveKitParticipantTokenResult,
  CreateLiveKitRoomInput,
  CreateLiveKitRoomResult,
  GetLiveKitRoomStateInput,
  LiveKitConfig,
  LiveKitRoomMetadata,
  LiveKitRoomState,
  LiveKitRoomSummary,
  LiveKitWebhookResult,
} from "./livekit.types";
import type { UUIDType } from "src/common";

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);

  constructor(private readonly envService: EnvService) {}

  buildRoomName(liveTrainingId: UUIDType, sessionId: UUIDType) {
    return `lt_${liveTrainingId}_${sessionId}`;
  }

  buildParticipantIdentity(sessionId: UUIDType, userId: UUIDType) {
    return `lt:${sessionId}:${userId}`;
  }

  async createRoom(input: CreateLiveKitRoomInput): Promise<CreateLiveKitRoomResult> {
    const client = await this.getRoomClient();
    const metadata = this.stringifyMetadata(input.metadata);

    const room = await client.createRoom({
      name: input.roomName,
      maxParticipants: input.maxParticipants,
      metadata,
      emptyTimeout: input.emptyTimeoutSeconds ?? LIVEKIT_DEFAULT_ROOM_EMPTY_TIMEOUT_SECONDS,
      departureTimeout:
        input.departureTimeoutSeconds ?? LIVEKIT_DEFAULT_ROOM_DEPARTURE_TIMEOUT_SECONDS,
    });

    return {
      rawRoom: room,
      room: this.mapRoomSummary(room),
      roomName: input.roomName,
    };
  }

  async getRoom(roomName: string): Promise<LiveKitRoomSummary | null> {
    const client = await this.getRoomClient();
    const [room] = await client.listRooms([roomName]);

    if (!room) {
      return null;
    }

    return this.mapRoomSummary(room);
  }

  async getRoomState(input: GetLiveKitRoomStateInput): Promise<LiveKitRoomState> {
    const room = await this.getRoom(input.roomName);

    return {
      exists: Boolean(room),
      room,
      participantCount: room?.participantCount ?? 0,
    };
  }

  async getParticipantCount(roomName: string): Promise<number> {
    const room = await this.getRoom(roomName);

    return room?.participantCount ?? 0;
  }

  async deleteRoom(roomName: string): Promise<void> {
    const client = await this.getRoomClient();

    try {
      await client.deleteRoom(roomName);
    } catch (error) {
      if (this.isMissingRoomError(error)) {
        return;
      }

      throw error;
    }
  }

  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    const client = await this.getRoomClient();

    return client.listParticipants(roomName);
  }

  async createParticipantToken(
    input: CreateLiveKitParticipantTokenInput,
  ): Promise<CreateLiveKitParticipantTokenResult> {
    const config = await this.getConfig();
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: input.identity,
      name: input.displayName ?? undefined,
      metadata: input.metadata ? this.stringifyMetadata(input.metadata) : undefined,
      attributes: input.attributes,
      ttl: input.ttlSeconds ?? LIVEKIT_DEFAULT_TOKEN_TTL_SECONDS,
    });

    token.addGrant(this.createVideoGrant(input));

    return {
      token: await token.toJwt(),
      url: config.url,
      identity: input.identity,
    };
  }

  async assertConfigured(): Promise<void> {
    await this.getConfig();
  }

  async receiveWebhook(body: string, authorizationHeader?: string): Promise<LiveKitWebhookResult> {
    const config = await this.getConfig();
    const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);

    try {
      return await receiver.receive(body, authorizationHeader);
    } catch (error) {
      this.logger.warn(
        `LiveKit webhook verification failed: ${this.getWebhookVerificationDiagnostics(
          body,
          authorizationHeader,
          config,
          error,
        )}`,
      );

      throw new UnauthorizedException("liveTraining.errors.liveKitWebhookUnauthorized");
    }
  }

  private async getRoomClient() {
    const config = await this.getConfig();

    return new RoomServiceClient(config.url, config.apiKey, config.apiSecret);
  }

  private async getConfig(): Promise<LiveKitConfig> {
    const config = await this.envService.getLiveKitConfig();

    if (!config.url || !config.apiKey || !config.apiSecret) {
      throw new BadRequestException("liveTraining.errors.liveKitNotConfigured");
    }

    return config;
  }

  private mapRoomSummary(room: Room): LiveKitRoomSummary {
    return {
      sid: room.sid,
      name: room.name,
      metadata: this.parseRoomMetadata(room.metadata),
      participantCount: room.numParticipants,
      publisherCount: room.numPublishers,
      maxParticipants: room.maxParticipants,
      activeRecording: room.activeRecording,
      createdAtMs: Number(room.creationTimeMs),
    };
  }

  private parseRoomMetadata(metadata: string): LiveKitRoomMetadata | null {
    if (!metadata) {
      return null;
    }

    try {
      const parsed = JSON.parse(metadata) as Partial<LiveKitRoomMetadata>;

      if (!parsed.tenantId || !parsed.liveTrainingId || !parsed.sessionId) {
        return null;
      }

      return {
        tenantId: parsed.tenantId,
        liveTrainingId: parsed.liveTrainingId,
        sessionId: parsed.sessionId,
      };
    } catch {
      return null;
    }
  }

  private createVideoGrant(input: CreateLiveKitParticipantTokenInput): VideoGrant {
    const publishSources = this.getPublishSources(input);
    const canPublish = publishSources.length > 0;

    return {
      roomJoin: true,
      room: input.roomName,
      canSubscribe: true,
      canPublish,
      canPublishSources: publishSources,
      canPublishData: input.canPublishData ?? true,
      canUpdateOwnMetadata: input.canUpdateOwnMetadata ?? false,
    };
  }

  private getPublishSources(input: CreateLiveKitParticipantTokenInput): TrackSource[] {
    const sources: TrackSource[] = [];

    if (input.canPublishVideo) {
      sources.push(TrackSource.CAMERA);
    }

    if (input.canPublishAudio) {
      sources.push(TrackSource.MICROPHONE);
    }

    if (input.canPublishScreenShare) {
      sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    }

    return sources;
  }

  private stringifyMetadata(metadata: Record<string, unknown>) {
    return JSON.stringify(metadata);
  }

  private isMissingRoomError(error: unknown) {
    return error instanceof TwirpError && (error.status === 404 || error.code === "not_found");
  }

  private getWebhookVerificationDiagnostics(
    body: string,
    authorizationHeader: string | undefined,
    config: LiveKitConfig,
    error: unknown,
  ) {
    const bodyHash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const tokenPartCount = authorizationHeader?.split(".").length ?? 0;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return JSON.stringify({
      reason: errorMessage,
      hasAuthorizationHeader: Boolean(authorizationHeader),
      authorizationHeaderLength: authorizationHeader?.length ?? 0,
      authorizationHeaderStartsWithBearer: authorizationHeader?.startsWith("Bearer ") ?? false,
      authorizationTokenPartCount: tokenPartCount,
      bodyLength: body.length,
      bodySha256Prefix: bodyHash,
      liveKitUrlConfigured: Boolean(config.url),
      liveKitApiKeyConfigured: Boolean(config.apiKey),
      liveKitApiSecretConfigured: Boolean(config.apiSecret),
      liveKitApiKeyLength: config.apiKey.length,
      liveKitApiSecretLength: config.apiSecret.length,
    });
  }
}
