import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { AudioGateway } from "src/audio/audio.gateway";
import { AUDIO_PROCESSORS } from "src/audio/audio.tokens";
import { AudioWorker } from "src/audio/audio.worker";
import { TranscriptionProcessor } from "src/audio/processors/transcriptionProcessor";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { AudioService } from "./audio.service";

@Module({
  imports: [AiModule],
  providers: [
    AudioService,
    AudioGateway,
    { provide: REALTIME_PUBLISHER, useExisting: AudioGateway },
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
