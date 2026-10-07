import { describe, expect, it } from "vitest";

import { targetedMentorOperationIds } from "./mentorReferenceFiles";

describe("targeted Mentor files", () => {
  it("shows only ready synthesized files, leaving raw source files and visuals distinct", () => {
    const record = (status: string, manifest: Record<string, unknown>) => ({
      id: "asset",
      kind: "asset",
      payload: { status, manifest },
    });
    expect(
      targetedMentorOperationIds([
        record("ready", { role: "mentor_context", operationId: "targeted", sourceVersionId: null }),
        record("ready", {
          role: "mentor_context",
          operationId: "legacy",
          sourceVersionId: "source",
        }),
        record("pending", { role: "mentor_context", operationId: "pending" }),
        record("ready", { role: "visual", operationId: "image" }),
      ]),
    ).toEqual(["targeted"]);
  });
});
