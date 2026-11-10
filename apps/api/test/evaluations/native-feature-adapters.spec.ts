import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";

import { runAssistantFeature, runAudioFeature } from "./native-feature-adapters";

import type { HttpRunConfig } from "./evaluation.types";
import type { FeatureCatalogue } from "./feature-catalogue.types";
import type { EvaluationSocket } from "./native-feature-adapters";

const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const itemFor = (id: string) => {
  const item = catalogue.features.find((feature) => feature.featureId === id)?.items[0];
  if (!item) throw new Error("Missing normalized fixture");
  return item;
};

describe("native assistant and dictation adapters with controlled transport", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(resolve(tmpdir(), "core-native-feature-test-"));
    process.env.CORE_NATIVE_FEATURE_TEST_COOKIE = "synthetic-cookie";
  });
  afterEach(() => {
    delete process.env.CORE_NATIVE_FEATURE_TEST_COOKIE;
    rmSync(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it.each(["completed", "failed-run", "missing-source"])(
    "checks native durable assistant outcome: %s",
    async (variant) => {
      const item = itemFor("assistant-authorized-read-tools");
      const config: HttpRunConfig = {
        baseUrl: "http://127.0.0.1:3000/api",
        disposableTenant: true,
        fixtures: {
          [item.id]: {
            cookieEnv: "CORE_NATIVE_FEATURE_TEST_COOKIE",
            isolated: true,
            threadId: "thread-1",
            expectedSourceUrls: ["http://127.0.0.1:3000/article/policy"],
            forbiddenSourceUrls: ["http://127.0.0.1:3000/article/foreign"],
          },
        },
      };
      let clientId = "";
      let step = 0;
      const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
        let data: unknown;
        if (step === 0) data = { available: true };
        if (step === 1) data = { id: "thread-1", language: "en", archived: false };
        if (step === 2) data = { items: [], totalItems: 0, latestRun: null };
        if (step === 3) {
          clientId = JSON.parse(String(init?.body)).clientMessageId;
          data = {
            run: { id: "run-1" },
            userMessage: { id: "user-1" },
            assistantMessage: { id: "assistant-1" },
          };
        }
        if (step === 4)
          data = {
            latestRun: { id: "run-1", status: variant === "failed-run" ? "failed" : "completed" },
            items: [
              {
                id: "user-1",
                clientMessageId: clientId,
                threadId: "thread-1",
                role: "user",
                text: item.input.scenario,
              },
              {
                id: "assistant-1",
                threadId: "thread-1",
                role: "assistant",
                status: variant === "failed-run" ? "failed" : "complete",
                text: "The badge policy says issue is free at reception.",
                sources:
                  variant === "missing-source"
                    ? []
                    : [{ title: "Badge policy", url: "http://127.0.0.1:3000/article/policy" }],
              },
            ],
          };
        step += 1;
        return new Response(JSON.stringify({ data }));
      });
      const result = await runAssistantFeature(item, config);
      expect(result.status).toBe(variant === "completed" ? "needs_review" : "failed");
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(fetchMock.mock.calls[3][0]).toBe(
        "http://127.0.0.1:3000/api/assistant/threads/thread-1/messages",
      );
      expect(fetchMock.mock.calls[3][1]?.method).toBe("POST");
      expect(JSON.stringify(result)).not.toContain("synthetic-cookie");
    },
  );

  it("refuses a reused assistant conversation before sending a new request", async () => {
    const item = itemFor("assistant-conversation");
    const config: HttpRunConfig = {
      baseUrl: "http://127.0.0.1:3000/api",
      disposableTenant: true,
      fixtures: {
        [item.id]: {
          cookieEnv: "CORE_NATIVE_FEATURE_TEST_COOKIE",
          isolated: true,
          threadId: "old-thread",
        },
      },
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { available: true } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { id: "old-thread", language: "en", archived: false } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { items: [{ text: "old" }], totalItems: 1 } })),
      );
    await expect(runAssistantFeature(item, config)).rejects.toThrow("not fresh");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(["transcript", "empty", "protocol-error"])(
    "uses actual Core audio socket protocol: %s (no ASR executed)",
    async (variant) => {
      const item = itemFor("mentor-transcription");
      const audio = Buffer.alloc(3200, 1);
      const path = resolve(directory, "synthetic.pcm");
      writeFileSync(path, audio);
      const config: HttpRunConfig = {
        baseUrl: "http://127.0.0.1:3000/api",
        disposableTenant: true,
        fixtures: {
          [item.id]: {
            cookieEnv: "CORE_NATIVE_FEATURE_TEST_COOKIE",
            isolated: true,
            audioPath: path,
            audioSampleRate: 16000,
            audioSha256: createHash("sha256").update(audio).digest("hex"),
          },
        },
      };
      const handlers = new Map<string, Set<(...args: any[]) => void>>();
      const dispatch = (event: string, payload?: unknown) => {
        for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
      };
      const socket: EvaluationSocket = {
        on: (event, handler) => {
          const listeners = handlers.get(event) ?? new Set();
          listeners.add(handler);
          handlers.set(event, listeners);
        },
        off: (event, handler) => {
          handlers.get(event)?.delete(handler);
        },
        emit: jest.fn((event) => {
          if (event === VOICE_SOCKET_EVENT.START_AUDIO)
            dispatch(VOICE_SOCKET_EVENT.AUDIO_STARTED, {});
          if (event === VOICE_SOCKET_EVENT.STOP_AUDIO)
            dispatch(VOICE_SOCKET_EVENT.STOP_AUDIO, {
              voiceAction: VOICE_ACTION.TRANSCRIPT,
              payload: variant === "empty" ? "" : item.input.task.expectedTranscript,
              error: variant === "protocol-error" ? "synthetic-error" : undefined,
            });
        }),
        connect: jest.fn(() => dispatch("connect")),
        disconnect: jest.fn(),
      };
      const factory = jest.fn().mockReturnValue(socket);
      const result = await runAudioFeature(item, config, factory);
      expect(result.status).toBe(variant === "transcript" ? "needs_review" : "failed");
      expect(factory).toHaveBeenCalledWith(
        "http://127.0.0.1:3000/ws",
        expect.objectContaining({
          path: "/api/ws",
          transports: ["websocket"],
          reconnection: false,
        }),
      );
      expect(socket.emit).toHaveBeenCalledWith(VOICE_SOCKET_EVENT.START_AUDIO, {
        voiceAction: VOICE_ACTION.TRANSCRIPT,
        meta: { sr: 16000, channels: 1, format: "pcm_s16le" },
      });
      expect(socket.emit).toHaveBeenCalledWith(
        VOICE_SOCKET_EVENT.AUDIO_CHUNK,
        expect.objectContaining({
          bytes: audio,
          meta: expect.objectContaining({ seq: 0, samples: 1600 }),
        }),
      );
      expect(socket.disconnect).toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain("synthetic-cookie");
    },
  );

  it("rejects a missing or mismatched supplied audio fixture before creating a socket", async () => {
    const item = itemFor("mentor-transcription");
    const factory = jest.fn();
    const config: HttpRunConfig = {
      baseUrl: "http://127.0.0.1:3000/api",
      disposableTenant: true,
      fixtures: { [item.id]: { cookieEnv: "CORE_NATIVE_FEATURE_TEST_COOKIE", isolated: true } },
    };
    await expect(runAudioFeature(item, config, factory)).rejects.toThrow("supplied synthetic");
    expect(factory).not.toHaveBeenCalled();
  });
});
