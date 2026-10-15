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
