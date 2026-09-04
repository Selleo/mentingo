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

  findBySessionRunId(sessionRunId: string): ExternalAudioSession | undefined {
    return [...this.sessions.values()].find((session) => session.sessionRunId === sessionRunId);
  }

  rebind(session: ExternalAudioSession, sessionId: string): string {
    const previousSessionId = session.sessionId;
    this.sessions.delete(previousSessionId);
    session.sessionId = sessionId;
    this.sessions.set(sessionId, session);
    return previousSessionId;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
