import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
  SUPPORTED_LANGUAGES,
  VOICE_ACTION,
  VOICE_SOCKET_EVENT,
} from "@repo/shared";

import { validateHttpConfig } from "./http-adapter";

import type { HttpRunConfig, NativeHttpExchange } from "./evaluation.types";
import type { FeatureItem, FeatureTaskResult } from "./feature-catalogue.types";

const nativeCommon = (item: FeatureItem) => ({
  caseId: item.id,
  featureId: item.metadata.featureId,
  executionLevel: item.metadata.executionLevel,
  promptFragments: [],
});
const fixtureFor = (item: FeatureItem, config: HttpRunConfig) => {
  validateHttpConfig(config);
  const fixture = config.fixtures[item.id];
  if (!fixture) throw new Error("Feature requires a supplied isolated synthetic fixture");
  const cookie = process.env[fixture.cookieEnv];
  if (!cookie) throw new Error("Missing explicit feature authentication environment variable");
  return { fixture, cookie };
};

/** Exercise the durable native assistant job, owned message readback and authorized source outcomes. */
export async function runAssistantFeature(
  item: FeatureItem,
  config: HttpRunConfig,
): Promise<FeatureTaskResult> {
  const { fixture, cookie } = fixtureFor(item, config);
  if (!fixture.threadId) throw new Error("Assistant requires a fresh owned synthetic thread");
  const base = config.baseUrl.replace(/\/$/, "");
  const exchanges: NativeHttpExchange[] = [];
  let authenticatedActor: { id: string; roleSlugs: unknown; permissions: unknown } | undefined;
  const request = async (path: string, body?: Record<string, unknown>) => {
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Object.assign(new Error("Assistant application request failed"), {
        status: response.status,
      });
    const json = (await response.json()) as { data?: Record<string, any> };
    if (!json.data || typeof json.data !== "object")
      throw new Error("Assistant response lacks data");
    exchanges.push({
      method: body ? "POST" : "GET",
      path,
      httpStatus: response.status,
      responseSha256: createHash("sha256").update(JSON.stringify(json.data)).digest("hex"),
      response: json.data,
    });
    return json.data;
  };
  if (fixture.actorUserId) {
    const actor = await request("/auth/current-user");
    if (actor.id !== fixture.actorUserId)
      throw new Error("Authenticated assistant actor does not match isolated fixture");
    authenticatedActor = {
      id: actor.id,
      roleSlugs: actor.roleSlugs,
      permissions: actor.permissions,
    };
  }
  if ((await request("/assistant/availability")).available !== true)
    throw new Error("Assistant unavailable in supplied fixture");
  const path = `/assistant/threads/${encodeURIComponent(fixture.threadId)}`;
  const thread = await request(path);
  const language = item.input.task.language ?? SUPPORTED_LANGUAGES.EN;
  if (thread.id !== fixture.threadId || thread.archived || thread.language !== language)
    throw new Error("Assistant thread identity/language is invalid");
  const messagesPath = `${path}/messages?page=1&perPage=100`;
  const before = await request(messagesPath);
  if (!Array.isArray(before.items) || before.items.length || before.totalItems !== 0)
    throw new Error("Assistant fixture thread is not fresh");
  if (
    item.input.task.requireSources &&
    (!fixture.expectedSourceUrls?.length || !Array.isArray(fixture.forbiddenSourceUrls))
  )
    throw new Error("Readable-content case requires exact expected/forbidden native source URLs");
  const clientMessageId = randomUUID();
  const queued = await request(`${path}/messages`, {
    clientMessageId,
    text: item.input.scenario,
    language,
  });
  if (!queued.run?.id || !queued.userMessage?.id || !queued.assistantMessage?.id)
    throw new Error("Assistant did not return persisted run/message identities");
  const deadline = Date.now() + 120000;
  let final: Record<string, any> | undefined;
  while (Date.now() < deadline) {
    const page = await request(messagesPath);
    if (
      page.latestRun?.id === queued.run.id &&
      [
        ASSISTANT_RUN_STATUSES.COMPLETED,
        ASSISTANT_RUN_STATUSES.FAILED,
        ASSISTANT_RUN_STATUSES.CANCELLED,
      ].includes(page.latestRun.status)
    ) {
      final = page;
      break;
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!final || !Array.isArray(final.items))
    throw new Error("Assistant timed out without terminal persisted evidence");
  const user = final.items.find(
    (message: Record<string, any>) => message.id === queued.userMessage.id,
  );
  const answer = final.items.find(
    (message: Record<string, any>) => message.id === queued.assistantMessage.id,
  );
  const sources: string[] = Array.isArray(answer?.sources)
    ? answer.sources.map((source: Record<string, any>) => source.url)
    : [];
  const checks = {
    nativeRunCompleted: final.latestRun.status === ASSISTANT_RUN_STATUSES.COMPLETED,
    userMessagePersisted:
      user?.role === ASSISTANT_MESSAGE_ROLES.USER &&
      user?.text === item.input.scenario &&
      user?.clientMessageId === clientMessageId &&
      user?.threadId === fixture.threadId,
    assistantMessagePersisted:
      answer?.role === ASSISTANT_MESSAGE_ROLES.ASSISTANT &&
      answer?.status === ASSISTANT_MESSAGE_STATUSES.COMPLETE &&
      answer?.threadId === fixture.threadId &&
      typeof answer?.text === "string" &&
      answer.text.trim().length > 0,
    requiredSources:
      !item.input.task.requireSources ||
      (fixture.expectedSourceUrls ?? []).every((url) => sources.includes(url)),
    forbiddenSources: (fixture.forbiddenSourceUrls ?? []).every((url) => !sources.includes(url)),
  };
  return {
    ...nativeCommon(item),
    status: Object.values(checks).every(Boolean) ? "needs_review" : "failed",
    checks,
    output: {
      nativeTransport: {
        kind: "authenticated_http_requests_and_authorized_native_readbacks",
        baseUrl: base,
        authentication: { cookieEnv: fixture.cookieEnv, actor: authenticatedActor },
        exchanges,
        providerInternalsCaptured: false,
      },
      runId: final.latestRun.id,
      runStatus: final.latestRun.status,
      assistantMessage: answer
        ? { id: answer.id, text: answer.text, status: answer.status, sources: answer.sources }
        : null,
      userMessageId: user?.id,
    },
  };
}

/** Minimal Socket.IO boundary, injected in tests so no socket/provider is opened. */
export type EvaluationSocket = {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
  connect: () => void;
  disconnect: () => void;
};
export type EvaluationSocketFactory = (
  url: string,
  options: Record<string, unknown>,
) => EvaluationSocket;
const defaultSocketFactory: EvaluationSocketFactory = (url, options) => {
  const webRequire = createRequire(resolve(__dirname, "../../../../apps/web/package.json"));
  const { io } = webRequire("socket.io-client") as { io: EvaluationSocketFactory };
  return io(url, options);
};

/** Real Core dictation protocol: /ws namespace, /api/ws path; there is no transcription HTTP route. */
export async function runAudioFeature(
  item: FeatureItem,
  config: HttpRunConfig,
  createSocket: EvaluationSocketFactory = defaultSocketFactory,
): Promise<FeatureTaskResult> {
  const { fixture, cookie } = fixtureFor(item, config);
  if (
    !fixture.audioPath ||
    !fixture.audioSha256 ||
    fixture.audioSampleRate !== 16000 ||
    !item.input.task.expectedTranscript
  )
    throw new Error(
      "Audio requires supplied synthetic 16kHz mono PCM asset/hash and versioned expected script",
    );
  const audio = readFileSync(fixture.audioPath);
  const audioHash = createHash("sha256").update(audio).digest("hex");
  if (
    !audio.length ||
    audio.length > 2000000 ||
    audio.length % 2 ||
    audioHash !== fixture.audioSha256
  )
    throw new Error("Synthetic PCM fixture identity/shape is invalid");
  let wavArtifact:
    | { path: string; sha256: string; byteSize: number; mediaType: string }
    | undefined;
  if (fixture.audioWavPath || fixture.audioWavSha256) {
    if (!fixture.audioWavPath || !fixture.audioWavSha256)
      throw new Error("WAV evidence requires both its path and checksum");
    const wav = readFileSync(fixture.audioWavPath);
    const hash = createHash("sha256").update(wav).digest("hex");
    if (
      wav.length < 1000 ||
      wav.subarray(0, 4).toString() !== "RIFF" ||
      wav.subarray(8, 12).toString() !== "WAVE" ||
      hash !== fixture.audioWavSha256
    )
      throw new Error("Actual synthetic WAV evidence is invalid");
    wavArtifact = {
      path: fixture.audioWavPath,
      sha256: hash,
      byteSize: wav.length,
      mediaType: "audio/wav",
    };
  }
  let authenticatedActor: { id: string; roleSlugs: unknown; httpStatus: number } | undefined;
  if (fixture.actorUserId) {
    const authenticated = await fetch(`${config.baseUrl.replace(/\/$/, "")}/auth/current-user`, {
      redirect: "error",
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(30000),
    });
    if (!authenticated.ok)
      throw Object.assign(new Error("Native audio actor authentication failed"), {
        status: authenticated.status,
      });
    const body = (await authenticated.json()) as { data?: { id?: string; roleSlugs?: unknown } };
    if (body.data?.id !== fixture.actorUserId)
      throw new Error("Authenticated audio actor does not match isolated fixture");
    authenticatedActor = {
      id: body.data.id,
      roleSlugs: body.data.roleSlugs,
      httpStatus: authenticated.status,
    };
  }
  const origin = new URL(config.baseUrl).origin;
  const socket = createSocket(`${origin}/ws`, {
    path: "/api/ws",
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    extraHeaders: { Cookie: cookie },
  });
  const waitFor = (event: string, timeoutMs: number): Promise<any> =>
    new Promise((accept, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Audio protocol timed out"));
      }, timeoutMs);
      const success = (payload: unknown) => {
        cleanup();
        accept(payload);
      };
      const failure = () => {
        cleanup();
        reject(new Error("Audio protocol failed"));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off(event, success);
        socket.off("connect_error", failure);
        socket.off("exception", failure);
      };
      socket.on(event, success);
      socket.on("connect_error", failure);
      socket.on("exception", failure);
    });
  try {
    const connected = waitFor("connect", 10000);
    socket.connect();
    await connected;
    const started = waitFor(VOICE_SOCKET_EVENT.AUDIO_STARTED, 10000);
    socket.emit(VOICE_SOCKET_EVENT.START_AUDIO, {
      voiceAction: VOICE_ACTION.TRANSCRIPT,
      meta: { sr: 16000, channels: 1, format: "pcm_s16le" },
    });
    await started;
    const completed = waitFor(VOICE_SOCKET_EVENT.STOP_AUDIO, 60000);
    let sequence = 0;
    for (let offset = 0; offset < audio.length; offset += 64000) {
      const bytes = audio.subarray(offset, Math.min(offset + 64000, audio.length));
      socket.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, {
        meta: { seq: sequence, sr: 16000, samples: bytes.length / 2, ts_ms: offset / 32 },
        bytes,
      });
      sequence += 1;
    }
    socket.emit(VOICE_SOCKET_EVENT.STOP_AUDIO, { lastSeq: sequence - 1 });
    const response = (await completed) as {
      voiceAction?: string;
      payload?: unknown;
      error?: unknown;
      translationKey?: unknown;
    };
    const checks = {
      transcriptAction: response.voiceAction === VOICE_ACTION.TRANSCRIPT,
      nonemptyTranscript:
        typeof response.payload === "string" && response.payload.trim().length > 0,
      noProtocolError: !response.error && !response.translationKey,
    };
    return {
      ...nativeCommon(item),
      status: Object.values(checks).every(Boolean) ? "needs_review" : "failed",
      checks,
      output: {
        nativeTransport: {
          kind: "authenticated_socket_io_protocol",
          namespace: "/ws",
          path: "/api/ws",
          authentication: { cookieEnv: fixture.cookieEnv, actor: authenticatedActor },
          connected: true,
          audioStarted: true,
          audioChunkCount: sequence,
          terminalResponse: response,
          providerInternalsCaptured: false,
        },
        transcript: typeof response.payload === "string" ? response.payload : null,
        expectedScript: item.input.task.expectedTranscript,
        audioSha256: audioHash,
        audioBytes: audio.length,
        sampleRate: 16000,
        inputAudio: {
          path: fixture.audioPath,
          sha256: audioHash,
          byteSize: audio.length,
          mediaType: "audio/pcm",
          ...(wavArtifact ? { wav: wavArtifact } : {}),
        },
      },
    };
  } finally {
    socket.disconnect();
  }
}
