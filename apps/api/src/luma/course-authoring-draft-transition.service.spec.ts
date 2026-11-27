import { ForbiddenException } from "@nestjs/common";
import { AxiosError } from "axios";

import { CourseAuthoringDraftTransitionService } from "./course-authoring-draft-transition.service";

const tenantId = "00000000-0000-4000-8000-000000000001";
const placeholderId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const ownerId = "00000000-0000-4000-8000-000000000004";
const nativeCourseId = "00000000-0000-4000-8000-000000000005";
const exportId = "00000000-0000-4000-8000-000000000006";

const job = { tenantId, courseId: placeholderId, sessionId, exportId, exportHash: "hash" };

function setup(options: { owners?: { id: string; email: string }[] } = {}) {
  const calls: string[] = [];
  const owners = options.owners ?? [{ id: ownerId, email: "owner@example.test" }];
  const db = {
    select: jest.fn(() => ({
      from: () => ({ where: jest.fn().mockResolvedValue(owners) }),
    })),
  };
  const drafts = {
    find: jest.fn().mockResolvedValue({
      id: placeholderId,
      courseId: nativeCourseId,
      lumaSessionId: sessionId,
      ownerId,
    }),
  };
  const authoring = {
    getSession: jest.fn().mockResolvedValue({
      sessionId,
      courseId: nativeCourseId,
      language: "en",
      snapshotSequence: 7,
    }),
    sendCommand: jest.fn(async () => {
      calls.push("command");
    }),
  };
  const context = {
    getContext: jest.fn().mockResolvedValue({ title: "Course brief", chapters: [] }),
  };
  const bridge = {
    bind: jest.fn(async () => {
      calls.push("bind");
    }),
  };
  const service = new CourseAuthoringDraftTransitionService(
    db as never,
    { getLumaClient: jest.fn().mockResolvedValue({ authoring }) } as never,
    drafts as never,
    context as never,
    bridge as never,
  );
  return { service, calls, authoring, context, bridge };
}

const expectedBinding = {
  tenantId,
  courseId: nativeCourseId,
  sessionId,
  actorId: ownerId,
  language: "en",
  cursorSequence: 7,
};

describe(CourseAuthoringDraftTransitionService.name, () => {
  it("binds the native course before resuming the saved brief", async () => {
    const { service, calls, authoring, bridge } = setup();

    await service.resume(job, nativeCourseId);

    expect(bridge.bind).toHaveBeenCalledWith(expectedBinding);
    expect(calls).toEqual(["bind", "command"]);
    expect(authoring.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        command: expect.objectContaining({ actorId: ownerId, action: "request.create" }),
      }),
    );
  });

  it("keeps the session bound but skips the resume when the owner is archived", async () => {
    const { service, authoring, bridge, context } = setup({ owners: [] });

    await service.resume(job, nativeCourseId);

    expect(bridge.bind).toHaveBeenCalledWith(expectedBinding);
    expect(context.getContext).not.toHaveBeenCalled();
    expect(authoring.sendCommand).not.toHaveBeenCalled();
  });

  it("keeps the session bound but skips the resume when the owner lost course access", async () => {
    const { service, authoring, bridge, context } = setup();
    context.getContext.mockRejectedValue(new ForbiddenException("common.toast.noAccess"));

    await service.resume(job, nativeCourseId);

    expect(bridge.bind).toHaveBeenCalledWith(expectedBinding);
    expect(authoring.sendCommand).not.toHaveBeenCalled();
  });

  it("tolerates a fresh request that already attached the draft", async () => {
    const { service, authoring } = setup();
    authoring.sendCommand.mockRejectedValue(
      new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        data: { detail: "AUTHORING_DRAFT_ALREADY_ATTACHED" },
      } as never),
    );

    await expect(service.resume(job, nativeCourseId)).resolves.toBeUndefined();
  });

  it("propagates other producer conflicts so the receipt is retried", async () => {
    const { service, authoring } = setup();
    authoring.sendCommand.mockRejectedValue(
      new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        data: { detail: "OTHER" },
      } as never),
    );

    await expect(service.resume(job, nativeCourseId)).rejects.toBeInstanceOf(AxiosError);
  });
});
