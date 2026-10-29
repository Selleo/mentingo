import {
  createGuideClient,
  GuideApiError,
  SearchMode,
  SearchQueryMode,
  TutorialDomain,
} from "@mentingo/guide-sdk";
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CanceledError } from "axios";

import { HelpdeskClientService } from "./self-onboarding-client.service";

import type { GuideClientOptions, PublicTutorial } from "@mentingo/guide-sdk";

const VIDEO_ID = "94ae6718-a5f9-4c5a-9c16-7e84fde8ad38";
const tutorial: PublicTutorial = {
  key: "edit-course",
  revisionId: "a4b78126-80de-4edb-8900-cf513d419ed7",
  domain: TutorialDomain.CourseAuthoring,
  title: "Edit a course",
  description: "Course editing guide",
  language: "en",
  languageFallback: false,
  durationMs: 60_000,
  videoUrl: `https://help-videos.b-cdn.net/${VIDEO_ID}/playlist.m3u8`,
  posterUrl: `https://help-videos.b-cdn.net/${VIDEO_ID}/thumbnail.jpg`,
  pageKeys: ["courses.edit"],
  chapters: [
    {
      id: "editor",
      title: "Course editor",
      description: "Open the editor",
      startMs: 0,
      endMs: 60_000,
    },
  ],
};

function adapterFixture(responses: unknown[]) {
  const requests: {
    url?: string;
    method?: string;
    data: unknown;
    params: unknown;
    headers: Record<string, unknown>;
    timeout?: number;
    signal?: unknown;
  }[] = [];
  const adapter: GuideClientOptions["adapter"] = async (config) => {
    requests.push({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
      headers: config.headers.toJSON(),
      timeout: config.timeout,
      signal: config.signal,
    });
    return { data: responses.shift(), status: 200, statusText: "OK", headers: {}, config };
  };
  const client = createGuideClient({
    baseURL: "https://help.mentingo.com",
    timeoutMs: 5_000,
    adapter,
  });
  return { service: new HelpdeskClientService(client), requests };
}

describe("Helpdesk generated SDK adapter", () => {
  it("uses public generated routes with no credentials, bounded timeout and cancellation", async () => {
    const { service, requests } = adapterFixture([
      {
        mode: SearchMode.Hybrid,
        results: [
          {
            tutorial,
            chapterId: "editor",
            excerpt: "Open editor",
            startMs: 0,
            endMs: 60_000,
            rankScore: 0.04,
          },
        ],
      },
      tutorial,
      Object.values(TutorialDomain),
    ]);
    const result = await service.search({
      query: "edit",
      language: "en",
      appVersion: "4.20.1",
      features: ["news"],
    });
    expect(result.results[0].tutorial).toEqual(tutorial);
    expect(result.results[0].tutorial).not.toBe(tutorial);
    await service.getTutorial("edit-course", {
      language: "en",
      appVersion: "4.20.1",
      features: "news",
    });
    await service.getDomains();
    expect(requests.map(({ url, method }) => [url, method])).toEqual([
      ["/api/v1/search", "post"],
      ["/api/v1/tutorials/edit-course", "get"],
      ["/api/v1/domains", "get"],
    ]);
    expect(JSON.parse(requests[0].data as string)).toEqual({
      query: "edit",
      language: "en",
      appVersion: "4.20.1",
      features: ["news"],
    });
    expect(requests[1].params).toEqual({ language: "en", appVersion: "4.20.1", features: "news" });
    for (const request of requests) {
      expect(request.headers).not.toHaveProperty("Authorization");
      expect(request.headers).not.toHaveProperty("Cookie");
      expect(request.timeout).toBe(5_000);
      expect(request.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("accepts explicit keyword results and sends the strategy through the real SDK", async () => {
    const { service, requests } = adapterFixture([{ mode: SearchMode.Keyword, results: [] }]);
    const result = await service.search({
      query: "editor",
      language: "en",
      appVersion: "4.25.0",
      mode: SearchQueryMode.Keyword,
    });
    expect(result).toEqual({ mode: "keyword", results: [] });
    expect(JSON.parse(requests[0].data as string).mode).toBe("keyword");
  });

  it.each([
    ["provenance", { ...tutorial, source: { commit: "private-commit" } }],
    [
      "nested provenance",
      { ...tutorial, chapters: [{ ...tutorial.chapters[0], transcript: "private transcript" }] },
    ],
    ["missing title", { ...tutorial, title: undefined }],
    ["unsafe key", { ...tutorial, key: "../secret" }],
    ["invalid UUID", { ...tutorial, revisionId: "private" }],
    ["empty chapters", { ...tutorial, chapters: [] }],
    [
      "too many chapters",
      { ...tutorial, chapters: Array.from({ length: 101 }, () => tutorial.chapters[0]) },
    ],
    [
      "reversed timeline",
      { ...tutorial, chapters: [{ ...tutorial.chapters[0], startMs: 50_000, endMs: 40_000 }] },
    ],
    [
      "out of bounds timeline",
      { ...tutorial, chapters: [{ ...tutorial.chapters[0], endMs: 61_000 }] },
    ],
    [
      "overlapping chapters",
      {
        ...tutorial,
        chapters: [
          { ...tutorial.chapters[0], endMs: 40_000 },
          { ...tutorial.chapters[0], id: "second", startMs: 30_000 },
        ],
      },
    ],
    [
      "duplicate chapters",
      {
        ...tutorial,
        chapters: [
          { ...tutorial.chapters[0], endMs: 30_000 },
          { ...tutorial.chapters[0], startMs: 30_000 },
        ],
      },
    ],
    ["untrusted video host", { ...tutorial, videoUrl: "https://private.invalid/secret" }],
    ["non-HTTPS video", { ...tutorial, videoUrl: tutorial.videoUrl.replace("https:", "http:") }],
    ["signed video query", { ...tutorial, videoUrl: `${tutorial.videoUrl}?token=private` }],
    [
      "unsafe video path",
      { ...tutorial, videoUrl: tutorial.videoUrl.replace("playlist.m3u8", "private.mp4") },
    ],
    [
      "mismatched poster",
      { ...tutorial, posterUrl: tutorial.posterUrl.replace("help-videos", "other") },
    ],
    ["nonpositive duration", { ...tutorial, durationMs: 0 }],
  ])("rejects malformed response: %s without forwarding raw content", async (_name, response) => {
    const { service } = adapterFixture([response]);
    await expect(
      service.getTutorial("edit-course", { language: "en", appVersion: "4.20.1" }),
    ).rejects.toMatchObject({
      status: 503,
      response: { message: "helpdesk.errors.unavailable" },
    });
  });

  it("validates search result counts, chapter identity and finite ranks before MCP sees data", async () => {
    const hit = {
      tutorial,
      chapterId: "editor",
      excerpt: "Safe excerpt",
      startMs: 0,
      endMs: 60_000,
      rankScore: 0.5,
    };
    for (const response of [
      { mode: "hybrid", results: Array.from({ length: 11 }, () => hit) },
      { mode: "hybrid", results: [{ ...hit, chapterId: "missing" }] },
      { mode: "hybrid", results: [{ ...hit, rankScore: Number.POSITIVE_INFINITY }] },
      { mode: "hybrid", results: [{ ...hit, endMs: 60_001 }] },
      { mode: "hybrid", results: [], private: "provenance" },
    ]) {
      const { service } = adapterFixture([response]);
      await expect(
        service.search({ query: "", language: "en", appVersion: "4.20.1" }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it("rejects unknown or duplicate domains", async () => {
    for (const response of [
      ["private-domain"],
      [TutorialDomain.CourseAuthoring, TutorialDomain.CourseAuthoring],
    ]) {
      await expect(adapterFixture([response]).service.getDomains()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    }
  });

  it("maps safe retry information and hides upstream messages, IDs, and raw bodies", async () => {
    const privateError = new GuideApiError(
      "private provider message",
      429,
      "private-request",
      "120",
      undefined,
      true,
    );
    const client = { tutorials: { domains: jest.fn().mockRejectedValue(privateError) } };
    const service = new HelpdeskClientService(
      client as unknown as ConstructorParameters<typeof HelpdeskClientService>[0],
    );
    try {
      await service.getDomains();
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        message: "helpdesk.errors.unavailable",
        retryable: true,
        retryAfterSeconds: 60,
      });
      expect(JSON.stringify(error)).not.toContain("private");
    }
  });

  it("preserves safe not-found semantics only for tutorial detail", async () => {
    const error = new GuideApiError("private missing tutorial", 404, undefined, undefined);
    const client = {
      tutorials: {
        get: jest.fn().mockRejectedValue(error),
        domains: jest.fn().mockRejectedValue(error),
      },
    };
    const service = new HelpdeskClientService(
      client as unknown as ConstructorParameters<typeof HelpdeskClientService>[0],
    );
    await expect(
      service.getTutorial("edit-course", { appVersion: "4.20.1", language: "en" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDomains()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("aborts an unresponsive SDK request at the five second bound", async () => {
    jest.useFakeTimers();
    const timeout = jest.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), delay);
      return controller.signal;
    });
    try {
      const adapter: GuideClientOptions["adapter"] = (config) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener?.("abort", () =>
            reject(new CanceledError("private request cancellation")),
          );
        });
      const sdk = createGuideClient({
        baseURL: "https://help.mentingo.com",
        timeoutMs: 5_000,
        adapter,
      });
      const service = new HelpdeskClientService(sdk);
      const assertion = expect(service.getDomains()).rejects.toMatchObject({
        response: { message: "helpdesk.errors.unavailable", retryable: true },
      });
      await jest.advanceTimersByTimeAsync(5_000);
      await assertion;
      expect(timeout).toHaveBeenCalledWith(5_000);
    } finally {
      timeout.mockRestore();
      jest.useRealTimers();
    }
  });

  it("maps arbitrary transport failures to safe unavailable errors", async () => {
    const client = {
      tutorials: {
        domains: jest.fn().mockRejectedValue(new Error("https://private.invalid/?secret=token")),
      },
    };
    const service = new HelpdeskClientService(
      client as unknown as ConstructorParameters<typeof HelpdeskClientService>[0],
    );
    await expect(service.getDomains()).rejects.toMatchObject({
      response: { message: "helpdesk.errors.unavailable", retryable: true },
    });
    await expect(new HelpdeskClientService(null).getDomains()).rejects.toMatchObject({
      response: { message: "helpdesk.errors.disabled", retryable: false },
    });
  });
});
