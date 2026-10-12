import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";

import type { CourseAuthoringApplicationClaim } from "./course-authoring.types";
import type { DatabasePg } from "src/common";
import type { CourseAuthoringApplicationResult } from "src/storage/schema/course-authoring.schema";

const claim: CourseAuthoringApplicationClaim = {
  tenantId: "tenant",
  actorId: "actor",
  courseId: "course",
  sessionId: "session",
  exportId: "export",
  exportHash: "hash",
};
const applied: CourseAuthoringApplicationResult = {
  courseId: claim.courseId,
  sessionId: claim.sessionId,
  exportId: claim.exportId,
  exportHash: claim.exportHash,
  applicationId: "application",
  status: "applied",
  appliedOperationIds: ["operation"],
  entityMappings: {},
  assetMappings: {},
};
function setup(result: CourseAuthoringApplicationResult) {
  const insert = jest.fn();
  const execute = jest.fn();
  const transaction = {
    execute,
    select: () => ({ from: () => ({ where: async () => [{ ...claim, result }] }) }),
    insert,
  };
  const repository = new CourseAuthoringApplicationRepository({
    transaction: (action: (db: object) => Promise<unknown>) => action(transaction),
  } as unknown as DatabasePg);
  return { repository, insert, execute };
}

describe("Native application outcome authority", () => {
  it("a native receipt committed before the failure lock wins over terminal failure", async () => {
    const test = setup(applied);
    const result = await test.repository.recordFailureOnce(claim, {
      ...applied,
      status: "failed",
      appliedOperationIds: [],
    });
    expect(result).toBe(applied);
    expect(test.execute).toHaveBeenCalledTimes(1);
    expect(test.insert).not.toHaveBeenCalled();
  });
  it.each(["failed", "conflict"] as const)(
    "never applies an export already finalized as %s",
    async (status) => {
      const test = setup({ ...applied, status, appliedOperationIds: [] });
      const apply = jest.fn();
      await expect(test.repository.applyOnce(claim, apply)).rejects.toThrow(
        "courseAuthoring.errors.applicationFailed",
      );
      expect(apply).not.toHaveBeenCalled();
      expect(test.insert).not.toHaveBeenCalled();
    },
  );
});
