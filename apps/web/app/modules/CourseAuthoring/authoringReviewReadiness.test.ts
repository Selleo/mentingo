import { describe, expect, it } from "vitest";

import { requestGenerationPending } from "./authoringReviewReadiness";

import type { AssetTaskView, AuthoringTask, ProposalView } from "./courseAuthoring.types";

const task = (
  status: AuthoringTask["status"],
  requestId = "request",
  kind = "lesson",
): AuthoringTask => ({
  taskId: "task",
  requestId,
  kind,
  status,
  errorCode: null,
  outputId: null,
});
const proposal: ProposalView = {
  id: "proposal",
  taskId: "task",
  revision: 1,
  summary: "Saved change",
  operations: [],
  outline: null,
  decision: "pending",
  rationale: "",
  warnings: [],
  qualityConcernsAccepted: false,
  evidenceCount: 0,
  parentProposalId: null,
  manual: false,
  protectedEdits: [],
  blockedQuality: false,
};

describe("request generation readiness", () => {
  it.each(["queued", "running", "waiting_dependencies", "paused", "unknown"] as const)(
    "blocks saved proposal review during %s work in the same request",
    (status) => {
      expect(requestGenerationPending([task(status)], "request", [proposal])).toBe(true);
    },
  );
  it.each(["succeeded", "failed", "superseded", "stopped"] as const)(
    "allows saved proposal review once siblings are %s",
    (status) => {
      expect(requestGenerationPending([task(status)], "request", [proposal])).toBe(false);
    },
  );
  it("keeps related queued assets pending even when another sibling has failed", () => {
    expect(
      requestGenerationPending(
        [task("failed"), { ...task("queued", "request", "asset"), taskId: "asset" }],
        "request",
        [proposal],
      ),
    ).toBe(true);
  });
  it("does not let another request's generation block completed work", () => {
    expect(requestGenerationPending([task("running", "other")], "request", [proposal])).toBe(false);
  });
  it("distinguishes author review of a published proposal from unfinished clarification", () => {
    expect(
      requestGenerationPending([{ ...task("waiting_author"), outputId: proposal.id }], "request", [
        proposal,
      ]),
    ).toBe(false);
    expect(requestGenerationPending([task("waiting_author")], "request", [proposal])).toBe(true);
  });
});

describe("skipped optional image readiness", () => {
  const image: AssetTaskView = {
    taskId: "image-task",
    parentTaskId: "task",
    ready: false,
    status: "waiting_author",
    revision: 1,
    action: "asset.retry_submission",
    question: "Retry image?",
    request: {
      assetId: "image",
      operationId: "operation",
      purpose: "diagram",
      required: false,
      altText: "Diagram",
      source: { type: "generated", content: "Diagram", visualQuery: "diagram" },
    },
  };
  it("unblocks a skipped optional image but not an unskipped or required image", () => {
    const pending = { ...task("waiting_author", "request", "asset"), taskId: "image-task" };
    expect(requestGenerationPending([pending], "request", [proposal], [image])).toBe(true);
    expect(requestGenerationPending([pending], "request", [proposal], [image], ["image"])).toBe(
      false,
    );
    expect(
      requestGenerationPending(
        [pending],
        "request",
        [proposal],
        [{ ...image, request: { ...image.request, required: true } }],
        ["image"],
      ),
    ).toBe(true);
  });
  it("does not unblock lesson work through a matching omission", () => {
    const pending = { ...task("running"), taskId: "image-task" };
    expect(requestGenerationPending([pending], "request", [proposal], [image], ["image"])).toBe(
      true,
    );
  });
});
