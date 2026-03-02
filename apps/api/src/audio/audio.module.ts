import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { AudioGateway } from "src/audio/audio.gateway";
import { AUDIO_PROCESSORS } from "src/audio/audio.tokens";
import { AudioWorker } from "src/audio/audio.worker";
import { TranscriptionProcessor } from "src/audio/processors/transcriptionProcessor";
import { WebSocketModule } from "src/websocket";

import { AudioService } from "./audio.service";

@Module({
  imports: [AiModule, WebSocketModule],
  providers: [
    AudioService,
    AudioGateway,
    TranscriptionProcessor,
    {
      provide: AUDIO_PROCESSORS,
      inject: [TranscriptionProcessor],
      useFactory: (transcriptionProcessor: TranscriptionProcessor) => [transcriptionProcessor],
    },
    AudioWorker,
  ],
})
export class AudioModule {}
