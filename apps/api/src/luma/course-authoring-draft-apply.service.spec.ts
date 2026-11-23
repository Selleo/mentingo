import { PERMISSIONS } from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { validate } from "uuid";

import { CourseAuthoringDraftApplyService } from "./course-authoring-draft-apply.service";

import type {
  CourseAuthoringApplicationClaim,
  PreparedCourseAuthoringApplication,
} from "./course-authoring.types";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseAuthoringApplicationResult } from "src/storage/schema/course-authoring.schema";

jest.mock("src/outbox/outbox.constants", () => ({
  isOutboxProcessingEnabled: jest.fn(() => true),
}));

const placeholderId = "00000000-0000-4000-8000-000000000001";
const nativeCourseId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const operationId = "00000000-0000-4000-8000-000000000004";
const categoryId = "00000000-0000-4000-8000-000000000005";
const exportId = "00000000-0000-4000-8000-000000000006";
const actor: CurrentUserType = {
  tenantId: "00000000-0000-4000-8000-000000000007",
  userId: "00000000-0000-4000-8000-000000000008",
  email: "author@example.test",
  permissions: [],
  roleSlugs: [],
};

const validInput: PreparedCourseAuthoringApplication = {
  courseId: placeholderId,
  sessionId,
  exportId,
  exportHash: "a".repeat(64),
  assetMappings: {},
  preparedDocumentIds: {},
  assetMimeTypes: {},
  operations: [
    {
      operationId,
      type: "course.create",
      targetId: placeholderId,
      baselineHash: null,
      language: "pl",
      dependencies: [],
      payload: {
        title: "Zarządzanie projektami",
        description: "Zespół ma dwa tygodnie na oddanie projektu.",
        language: "pl",
        learningOutcomes: [],
        categoryId,
      },
    },
  ],
};

describe(CourseAuthoringDraftApplyService.name, () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

  function setup() {
    const transaction = {} as DatabasePg;
    const mocks = {
      applyOnce: jest.fn(
        async (
          _claim: CourseAuthoringApplicationClaim,
          apply: (trx: DatabasePg) => Promise<CourseAuthoringApplicationResult>,
        ) => apply(transaction),
      ),
      lockForCreation: jest.fn().mockResolvedValue(undefined),
      attachCourse: jest.fn().mockResolvedValue(undefined),
      resolveForCourseAuthoring: jest.fn().mockResolvedValue(categoryId),
      createCourseInTransaction: jest.fn().mockResolvedValue({ id: nativeCourseId }),
      publishCreateCourseEvent: jest.fn().mockResolvedValue(undefined),
      getUserAccess: jest.fn().mockResolvedValue({
        permissions: [PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_AI_GENERATION],
        roleSlugs: [],
      }),
    };
    const service = new CourseAuthoringDraftApplyService(
      mocks as unknown as ConstructorParameters<typeof CourseAuthoringDraftApplyService>[0],
      mocks as unknown as ConstructorParameters<typeof CourseAuthoringDraftApplyService>[1],
      mocks as unknown as ConstructorParameters<typeof CourseAuthoringDraftApplyService>[2],
      mocks as unknown as ConstructorParameters<typeof CourseAuthoringDraftApplyService>[3],
      mocks as unknown as ConstructorParameters<typeof CourseAuthoringDraftApplyService>[4],
    );
    return { service, mocks, transaction };
  }

  it("commits the same native transaction to the course, session mapping and creation event", async () => {
    const { service, mocks, transaction } = setup();
    const result = await service.applyPreparedExport(validInput, actor);

    expect(mocks.applyOnce).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: placeholderId, draftCourseId: placeholderId }),
      expect.any(Function),
      [],
    );
    expect(mocks.lockForCreation).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: actor.userId, sessionId }),
      transaction,
    );
    expect(mocks.createCourseInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ language: "pl", status: "draft", categoryId }),
      expect.objectContaining({ userId: actor.userId }),
      false,
      transaction,
      expect.stringContaining(exportId),
    );
    expect(mocks.attachCourse).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
      nativeCourseId,
      transaction,
    );
    expect(mocks.publishCreateCourseEvent).toHaveBeenCalledWith(
      nativeCourseId,
      "pl",
      expect.objectContaining({ userId: actor.userId }),
      transaction,
    );
    expect(result).toMatchObject({
      courseId: placeholderId,
      entityMappings: { [placeholderId]: nativeCourseId },
    });
  });

  it("rejects revoked create permissions before applying an approved export", async () => {
    const { service, mocks } = setup();
    mocks.getUserAccess.mockResolvedValueOnce({
      permissions: [PERMISSIONS.COURSE_AI_GENERATION],
      roleSlugs: [],
    });
    await expect(service.applyPreparedExport(validInput, actor)).rejects.toThrow(
      "common.toast.noAccess",
    );
    expect(mocks.applyOnce).not.toHaveBeenCalled();
  });

  it("rejects a mixed export before creating the course", async () => {
    const { service, mocks } = setup();
    await expect(
      service.applyPreparedExport(
        { ...validInput, operations: [...validInput.operations, ...validInput.operations] },
        actor,
      ),
    ).rejects.toThrow("courseAuthoring.errors.invalidOperations");
    expect(mocks.applyOnce).not.toHaveBeenCalled();
  });

  it("returns a committed receipt without repeating native course creation", async () => {
    const { mocks, service } = setup();
    const result = await service.applyPreparedExport(validInput, actor);
    mocks.applyOnce.mockResolvedValueOnce(result);

    await expect(service.applyPreparedExport(validInput, actor)).resolves.toEqual(result);
    expect(mocks.createCourseInTransaction).toHaveBeenCalledTimes(1);
  });
});
