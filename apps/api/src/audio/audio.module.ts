import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { AudioGateway } from "src/audio/audio.gateway";
import { AUDIO_PROCESSORS } from "src/audio/audio.tokens";
import { AudioWorker } from "src/audio/audio.worker";
import { ExternalAudioSessionStore } from "src/audio/external-audio-session.store";
import { ExternalAudioService } from "src/audio/external-audio.service";
import { TranscriptionProcessor } from "src/audio/processors/transcriptionProcessor";
import { LocalizationModule } from "src/localization/localization.module";
import { WebSocketModule } from "src/websocket";

import { AudioService } from "./audio.service";

@Module({
  imports: [AiModule, WebSocketModule, LocalizationModule],
  providers: [
    AudioService,
    ExternalAudioService,
    ExternalAudioSessionStore,
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
