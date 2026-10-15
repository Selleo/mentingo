import { CourseAuthoringOrderError } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { prepareCurriculumPreview } from "./prepareCurriculumPreview";

import type { AuthoringSession, CurriculumPreview } from "../courseAuthoring.types";

const preview: CurriculumPreview = { proposalId: "proposal", status: "pending", outline: [] };

describe("prepareCurriculumPreview", () => {
  it("opens complete content without fetching", async () => {
    const refresh = vi.fn();
    expect(await prepareCurriculumPreview(() => preview, refresh)).toBe(preview);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses the refreshed snapshot to recover missing dependencies once", async () => {
    const snapshot = { snapshotSequence: 2 } as AuthoringSession;
    const refresh = vi.fn().mockResolvedValue(snapshot);
    const build = vi.fn((current?: AuthoringSession) => {
      if (!current) throw new CourseAuthoringOrderError("missingDependency");
      return preview;
    });
    expect(await prepareCurriculumPreview(build, refresh)).toBe(preview);
    expect(refresh).toHaveBeenCalledOnce();
    expect(build).toHaveBeenLastCalledWith(snapshot);
  });

  it("permits inspection if the refresh fails without weakening the original build", async () => {
    const build = vi.fn((_?: AuthoringSession, inspect?: boolean) => {
      if (!inspect) throw new CourseAuthoringOrderError("missingDependency");
      return preview;
    });
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await prepareCurriculumPreview(build, refresh)).toBe(preview);
    expect(build).toHaveBeenLastCalledWith(undefined, true);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each(["duplicateOperation", "dependencyCycle"] as const)(
    "preserves %s errors",
    async (code) => {
      const refresh = vi.fn();
      await expect(
        prepareCurriculumPreview(() => {
          throw new CourseAuthoringOrderError(code);
        }, refresh),
      ).rejects.toMatchObject({ code });
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it("does not relabel unexpected failures as missing dependencies", async () => {
    const error = new TypeError("invalid preview");
    await expect(
      prepareCurriculumPreview(() => {
        throw error;
      }, vi.fn()),
    ).rejects.toBe(error);
  });
});
