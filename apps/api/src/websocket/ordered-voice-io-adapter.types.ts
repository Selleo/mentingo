import type { MessageMappingProperties } from "@nestjs/websockets";

export interface OrderedVoicePacket {
  handler: MessageMappingProperties;
  payload: unknown;
  bytes: number;
  receivedAt: number;
}
