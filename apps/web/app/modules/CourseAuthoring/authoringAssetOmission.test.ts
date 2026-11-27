import { describe, expect, it } from "vitest";

import { canOmitAuthoringAsset, omittedPodcastAssetIds } from "./authoringAssetOmission";
import { isTerminalAuthoringTaskFailure } from "./authoringTaskFailure";

import type { AssetTaskView, AuthoringTask } from "./courseAuthoring.types";

const podcast = (overrides: Partial<AssetTaskView>): AssetTaskView => ({
  taskId: "podcast-task",
  parentTaskId: null,
  status: "failed",
  revision: null,
  question: null,
  action: null,
  ready: false,
  terminalFailure: true,
  request: {
    assetId: "podcast",
    operationId: "operation",
    purpose: "podcast",
    required: true,
    altText: "Discussion",
    source: { type: "podcast", content: "Explore the trade-off" },
  },
  ...overrides,
});

const failedTask = (failure: AuthoringTask["failure"]): AuthoringTask => ({
  taskId: "podcast-task",
  requestId: "request",
  status: "failed",
  errorCode: null,
  outputId: null,
  failure,
});
const failure = {
  code: "podcast_failed",
  category: "provider",
  stage: "audio",
  recoveryAction: "retry_provider",
  retryable: true,
  affectedChapterIds: [],
  affectedLessonIds: [],
  correlationId: null,
  detailKey: null,
  generationRevision: 1,
} satisfies NonNullable<AuthoringTask["failure"]>;

describe("podcast omission", () => {
  it("treats only non-retryable or service-fix failures as terminal", () => {
    expect(isTerminalAuthoringTaskFailure(failedTask(failure))).toBe(false);
    expect(isTerminalAuthoringTaskFailure(failedTask(null))).toBe(false);
    expect(isTerminalAuthoringTaskFailure(failedTask({ ...failure, retryable: false }))).toBe(true);
    expect(
      isTerminalAuthoringTaskFailure(failedTask({ ...failure, recoveryAction: "service_fix" })),
    ).toBe(true);
    expect(
      isTerminalAuthoringTaskFailure({
        ...failedTask({ ...failure, retryable: false }),
        status: "running",
      }),
    ).toBe(false);
  });

  it("allows omitting a podcast only after terminal failure", () => {
    expect(canOmitAuthoringAsset(podcast({}))).toBe(true);
    expect(canOmitAuthoringAsset(podcast({ terminalFailure: false }))).toBe(false);
    expect(canOmitAuthoringAsset(podcast({ ready: true }))).toBe(false);
    expect(
      omittedPodcastAssetIds([podcast({}), podcast({ terminalFailure: false })], ["podcast"]),
    ).toEqual(["podcast"]);
    expect(omittedPodcastAssetIds([podcast({ terminalFailure: false })], ["podcast"])).toEqual([]);
  });
});
