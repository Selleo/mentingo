import type { Page } from "@playwright/test";

export const mockLumaConfigFlow = async (
  page: Page,
  { courseGenerationEnabled = false, voiceMentorEnabled = false },
) => {
  await page.route("**/api/env/luma", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          enabled: courseGenerationEnabled || voiceMentorEnabled,
          courseGenerationEnabled,
          voiceMentorEnabled,
        },
      },
    });
  });
};

const zeroUsage = () => ({
  total: {
    invocationCount: 0,
    pendingInvocationCount: 0,
    unknownTokenInvocationCount: 0,
    unknownCostInvocationCount: 0,
    reportedCostInvocationCount: 0,
    estimatedCostInvocationCount: 0,
    configurationEstimateInvocationCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reportedUsd: "0",
    estimatedUsd: "0",
    knownUsd: "0",
    tokensComplete: true,
    costComplete: true,
  },
  byTask: [],
  byRequest: [],
  byApiKey: [],
});

export const mockCourseAuthoringWorkspaceFlow = async (page: Page, courseId: string) => {
  const session = {
    schemaVersion: 1,
    sessionId: "00000000-0000-4000-8000-000000000001",
    courseId,
    language: "en",
    status: "active",
    snapshotSequence: 4,
    workspaceRevision: 4,
    records: [],
    tasks: [],
    usage: zeroUsage(),
  };
  await page.route("**/api/luma/authoring/**", async (route) => {
    throw new Error(`Unexpected authoring request in drawer smoke test: ${route.request().url()}`);
  });
  await page.route(
    (url) => url.pathname === `/api/luma/authoring/courses/${courseId}/sessions`,
    async (route) => {
      if (route.request().method() === "GET") {
        const params = new URL(route.request().url()).searchParams;
        await route.fulfill({
          contentType: "application/json",
          json: {
            data: [
              {
                ...session,
                title: "Current authoring chat",
                createdAt: "2026-09-22T08:00:00Z",
                lastActivityAt: "2026-09-22T09:00:00Z",
              },
            ],
            pagination: {
              totalItems: 1,
              page: Number(params.get("page") ?? 1),
              perPage: Number(params.get("perPage") ?? 8),
            },
          },
        });
        return;
      }
      await route.fulfill({ contentType: "application/json", json: { data: session } });
    },
  );
  await page.route(
    `**/api/luma/authoring/courses/${courseId}/sessions/${session.sessionId}`,
    async (route) => {
      await route.fulfill({ contentType: "application/json", json: { data: session } });
    },
  );
  await page.route(`**/api/luma/authoring/courses/${courseId}/context*`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          courseId,
          language: "en",
          title: "Deterministic authoring course",
          description: "A deterministic authoring fixture.",
          baselineHash: "baseline-hash",
          fieldHashes: {},
          chapters: [],
        },
      },
    });
  });
};
