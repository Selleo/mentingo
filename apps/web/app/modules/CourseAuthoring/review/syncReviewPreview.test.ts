import { expect, it } from "vitest";

import { syncReviewPreview } from "./syncReviewPreview";

import type { CurriculumPreview } from "../courseAuthoring.types";

it("refreshes ready assets in an open group without replacing its selected operations", () => {
  const active: CurriculumPreview = {
    proposalId: "request-group",
    authoringSessionId: "session-1",
    status: "pending",
    outline: [],
    readyAssetIds: [],
  };
  const latest: CurriculumPreview = {
    ...active,
    proposalId: "latest-proposal",
    readyAssetIds: ["diagram-1"],
  };
  expect(syncReviewPreview(active, latest)).toEqual({ ...active, readyAssetIds: ["diagram-1"] });
  expect(syncReviewPreview(active, { ...latest, authoringSessionId: "other-session" })).toBe(
    active,
  );
});

it("refreshes a podcast's retry and ready state without replacing the open review selection", () => {
  const podcast = {
    assetId: "podcast",
    operationId: "lesson-write",
    altText: "Lesson discussion",
  };
  const active: CurriculumPreview = {
    proposalId: "request-group",
    authoringSessionId: "session-1",
    status: "pending",
    outline: [],
    readyAssetIds: [],
    podcastAssets: [podcast],
  };
  const podcastTasks: NonNullable<CurriculumPreview["podcastTasks"]> = [
    {
      taskId: "podcast-task",
      parentTaskId: "lesson-task",
      request: {
        ...podcast,
        required: true,
        purpose: "podcast",
        source: { type: "podcast", content: "Explore the trade-off" },
      },
      status: "failed",
      revision: 1,
      question: null,
      action: null,
      ready: false,
      terminalFailure: false,
    },
  ];

  const failed = syncReviewPreview(active, { ...active, proposalId: "latest", podcastTasks });
  expect(failed).toEqual({ ...active, podcastTasks });

  const ready = syncReviewPreview(failed, {
    ...active,
    proposalId: "latest",
    readyAssetIds: ["podcast"],
    podcastTasks: [],
  });
  expect(ready).toEqual({ ...active, readyAssetIds: ["podcast"], podcastTasks: [] });
});
