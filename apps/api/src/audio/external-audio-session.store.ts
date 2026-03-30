import { Injectable } from "@nestjs/common";

import type { ExternalAudioSession } from "src/audio/types/external-audio-session.types";

@Injectable()
export class ExternalAudioSessionStore {
  private readonly sessions = new Map<string, ExternalAudioSession>();

  get(sessionId: string): ExternalAudioSession | undefined {
    return this.sessions.get(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  set(session: ExternalAudioSession): void {
    this.sessions.set(session.sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
