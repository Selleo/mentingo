import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { FileGuard } from "src/file/guards/file.guard";

import { CompetenciesService } from "./competencies.service";
import {
  competenciesCommandSchema,
  competenciesWorkspaceSchema,
  competencyRecordsQuerySchema,
} from "./schemas/competencies.schema";

import type { CompetenciesClientService } from "./competencies-client.service";
import type { CompetenciesSyncService } from "./competencies-sync.service";
import type { CompetenciesContextRepository } from "./repositories/competencies-context.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { UserService } from "src/user/user.service";

describe("Competencies trusted context", () => {
  it("bounds paged record requests and rejects malformed identities", () => {
    const query = { kind: "documents", page: "1", pageSize: "10" };
    expect(Value.Check(competencyRecordsQuerySchema, query)).toBe(true);
    for (const forged of [
      { page: "0" },
      { page: "-1" },
      { page: "1.5" },
      { pageSize: "1000" },
      { subjectId: "someone" },
      { kind: "raw-sql" },
    ]) {
      expect(Value.Check(competencyRecordsQuerySchema, { ...query, ...forged })).toBe(false);
    }
  });
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "manager@example.test",
    roleSlugs: [],
    permissions: [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  };
  it("rejects condition overrides that force an unmet result at the command schema boundary", () => {
    expect(
      Value.Check(competenciesCommandSchema, {
        operation: "set_condition_override",
        requestId: actor.userId,
        subjectId: actor.userId,
        competencyId: actor.userId,
        revision: 1,
        conditionId: "manual-review",
        status: "unmet",
        comment: "Forged failing override",
      }),
    ).toBe(false);
  });
  it("accepts persisted condition overrides without a competency revision", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      Value.Check(competenciesWorkspaceSchema, {
        revocations: [],
        catalog: [],
        profiles: [],
        publishedProfiles: [],
        subjects: [],
        verifiers: {},
        conditionOverrides: [
          {
            id,
            requestId: id,
            subjectId: id,
            competencyId: id,
            conditionId: "course",
            conditionRevision: "legacy",
            isCurrent: true,
            status: "met",
            comment: "Persisted override",
            createdAt: "2026-10-21T00:00:00.000Z",
            createdBy: id,
          },
        ],
        evidence: [],
        standings: [],
        assessments: [],
        actions: [],
        actionHistory: [],
        warningDays: null,
        asOf: "2026-10-21T00:00:00.000Z",
        evidenceHistory: [],
        awardHistory: [],
        people: [],
        courses: [],
        learningResources: [],
      }),
    ).toBe(true);
  });
  function setup() {
    const records = jest.fn().mockResolvedValue({ actions: [], evidence: [], total: 0 });
    const execute = jest.fn().mockResolvedValue({ id: "saved" });
    const workspace = jest.fn().mockResolvedValue({
      catalog: [],
      verifiers: {},
      subjects: [],
      actions: [{ ownerId: "plan-owner" }],
      evidence: [],
      revocations: [],
      standings: [],
    });
    const attachment = {
      body: { cancel: jest.fn() },
      contentType: "application/pdf",
      contentDisposition: "attachment",
    };
    const configuration = jest
      .fn()
      .mockResolvedValue({ capabilities: { competencies: { enabled: true } } });
    const uploadAttachment = jest.fn().mockResolvedValue({ id: "attachment" });
    const client = {
      run: jest.fn(async (operation) =>
        operation({
          execute,
          workspace,
          records,
          configuration,
          uploadAttachment,
          downloadAttachment: async () => attachment,
        }),
      ),
    };
    const repository = {
      managedSubjects: jest.fn().mockResolvedValue([{ id: "permitted" }]),
      people: jest.fn().mockResolvedValue([]),
      learningResourceExists: jest.fn().mockResolvedValue(true),
      availableCourses: jest.fn().mockResolvedValue([]),
      learningResources: jest.fn().mockResolvedValue([]),
      actorIdentity: jest.fn().mockResolvedValue({
        userId: actor.userId,
        tenantId: actor.tenantId,
        email: actor.email,
        roleSlugs: actor.roleSlugs,
      }),
    };
    const userService = {
      getPermissionsForRoleSlugs: jest.fn().mockResolvedValue(actor.permissions),
    };
    const syncService = { refreshSubjects: jest.fn() };
    return {
      service: new CompetenciesService(
        client as unknown as CompetenciesClientService,
        repository as unknown as CompetenciesContextRepository,
        userService as unknown as UserService,
        syncService as unknown as CompetenciesSyncService,
      ),
      repository,
      execute,
      userService,
      workspace,
      records,
      attachment,
      configuration,
      syncService,
      client,
      uploadAttachment,
    };
  }
  it("forwards bounded record reads with current core identity and permissions", async () => {
    const { service, records, userService } = setup();
    await expect(
      service.records(actor, { kind: "actions", page: "2", pageSize: "10" }),
    ).resolves.toEqual({ actions: [], evidence: [], total: 0, people: [] });
    expect(records).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.userId,
        canManage: false,
        managedSubjectIds: ["permitted"],
      }),
      { kind: "actions", page: 2, pageSize: 10 },
    );
    userService.getPermissionsForRoleSlugs.mockResolvedValue([]);
    await expect(
      service.records(actor, { kind: "actions", page: "1", pageSize: "10" }),
    ).rejects.toThrow("missingPermission");
    expect(records).toHaveBeenCalledTimes(1);
  });
  it("requires an action identity before reading action history", async () => {
    const { service, records } = setup();
    await expect(
      service.records(actor, { kind: "action-history", page: "1", pageSize: "10" }),
    ).rejects.toThrow("invalidAction");
    expect(records).not.toHaveBeenCalled();
  });
  it("derives administration and planning scope from current core permissions", async () => {
    const { service, repository, userService } = setup();
    expect(await service.context(actor)).toMatchObject({
      userId: actor.userId,
      canManage: false,
      managedSubjectIds: ["permitted"],
    });
    expect(repository.managedSubjects).toHaveBeenCalledWith(actor);
    userService.getPermissionsForRoleSlugs.mockResolvedValueOnce([
      PERMISSIONS.COMPETENCIES_USE,
      PERMISSIONS.COMPETENCIES_MANAGE,
      PERMISSIONS.TENANT_MANAGE,
    ]);
    expect(
      await service.context({
        ...actor,
        permissions: [
          PERMISSIONS.COMPETENCIES_USE,
          PERMISSIONS.COMPETENCIES_MANAGE,
          PERMISSIONS.TENANT_MANAGE,
        ],
      }),
    ).toMatchObject({ canManage: true });
  });
  it("enriches a review page only with identities from its authorized evidence", async () => {
    const { service, records, repository } = setup();
    records.mockResolvedValue({
      actions: [],
      evidence: [{ subjectId: "employee", createdBy: "uploader", reviewedBy: "reviewer" }],
      total: 1,
    });
    await service.records(actor, { kind: "review-history", page: "1", pageSize: "10" });
    expect(repository.people).toHaveBeenCalledWith(["employee", "uploader", "reviewer"]);
  });
  it("canonicalizes managed subject ordering in actor context", async () => {
    const { service, repository } = setup();
    repository.managedSubjects
      .mockResolvedValueOnce([{ id: "second" }, { id: "first" }])
      .mockResolvedValueOnce([{ id: "first" }, { id: "second" }]);

    const firstContext = await service.context(actor);
    const secondContext = await service.context(actor);

    expect(firstContext.managedSubjectIds).toEqual(["first", "second"]);
    expect(secondContext.managedSubjectIds).toEqual(firstContext.managedSubjectIds);
  });
  it("rejects access removed after request authentication before it delivers a result", async () => {
    const { service, userService } = setup();
    await service.context(actor);
    userService.getPermissionsForRoleSlugs.mockResolvedValue([]);
    await expect(service.context(actor)).rejects.toThrow("missingPermission");
  });
  it.each(["inactive", "foreign"])(
    "rejects an %s actor before reading plugin data",
    async (state) => {
      const { service, repository, workspace } = setup();
      repository.actorIdentity.mockResolvedValueOnce(
        state === "inactive"
          ? null
          : { userId: actor.userId, tenantId: "another-tenant", email: actor.email, roleSlugs: [] },
      );
      await expect(service.workspace(actor, "en")).rejects.toThrow("missingPermission");
      expect(workspace).not.toHaveBeenCalled();
      expect(repository.managedSubjects).not.toHaveBeenCalled();
    },
  );
  it("includes the owner of a visible personal plan without exposing unrelated people", async () => {
    const { service, repository } = setup();
    repository.managedSubjects.mockResolvedValue([]);
    await service.workspace({ ...actor, permissions: [PERMISSIONS.COMPETENCIES_USE] }, "en");
    expect(repository.people).toHaveBeenCalledWith([actor.userId, "plan-owner"]);
  });
  it("lets competency administrators browse all active tenant people", async () => {
    const { service, repository, userService } = setup();
    const admin = {
      ...actor,
      permissions: [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.COMPETENCIES_MANAGE],
    };
    userService.getPermissionsForRoleSlugs.mockResolvedValue(admin.permissions);
    repository.people.mockResolvedValue([
      { id: "unassigned", name: "Unassigned", archived: false },
    ]);
    const result = await service.workspace(admin, "en");
    expect(repository.people).toHaveBeenCalledWith(undefined);
    expect(result.people).toContainEqual({
      id: "unassigned",
      name: "Unassigned",
      archived: false,
      canPlan: true,
    });
  });
  it("provides a fresh verifier with a tenant people directory while keeping planning scoped", async () => {
    const { service, repository, workspace } = setup();
    repository.managedSubjects.mockResolvedValue([]);
    repository.people.mockResolvedValue([{ id: "peer", name: "Peer", archived: false }]);
    workspace.mockResolvedValue({
      catalog: [],
      verifiers: { competency: [actor.userId] },
      subjects: [{ id: actor.userId, profileId: null }],
      actions: [],
      evidence: [],
      revocations: [],
      standings: [],
    });
    const result = await service.workspace(actor, "en");
    expect(repository.people).toHaveBeenCalledWith(undefined);
    expect(result.people).toEqual([{ id: "peer", name: "Peer", archived: false, canPlan: false }]);
    expect(workspace).toHaveBeenCalledWith(
      expect.objectContaining({ managedSubjectIds: [], canManage: false }),
      undefined,
      undefined,
      false,
      undefined,
    );
  });
  it("cancels a downloaded file if current core access disappears before delivery", async () => {
    const { service, userService, attachment } = setup();
    userService.getPermissionsForRoleSlugs
      .mockResolvedValueOnce(actor.permissions)
      .mockResolvedValue([]);
    await expect(service.downloadAttachment(actor, "file")).rejects.toThrow("missingPermission");
    expect(attachment.body.cancel).toHaveBeenCalledTimes(1);
  });
  it("cancels a downloaded file if the plugin is disabled during retrieval", async () => {
    const { service, configuration, attachment } = setup();
    configuration.mockResolvedValue({ capabilities: { competencies: { enabled: false } } });
    await expect(service.downloadAttachment(actor, "file")).rejects.toThrow("conflict");
    expect(attachment.body.cancel).toHaveBeenCalledTimes(1);
  });

  it("uses current course permissions rather than stale broad request permissions", async () => {
    const { service, repository } = setup();
    await service.workspace(
      { ...actor, permissions: [...actor.permissions, PERMISSIONS.COURSE_READ_MANAGEABLE] },
      "en",
    );
    expect(repository.availableCourses).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: actor.permissions }),
      "en",
    );
  });

  it("rejects unknown or archived users before forwarding an evidence command", async () => {
    const { service, execute } = setup();
    await expect(
      service.execute(actor, {
        operation: "submit_evidence",
        value: {
          requestId: actor.userId,
          subjectId: actor.tenantId,
          competencyId: actor.userId,
          conditionIds: ["condition"],
          kind: "recognition",
          occurredAt: new Date().toISOString(),
          validUntil: null,
          note: "Recognized",
        },
      }),
    ).rejects.toThrow("invalidSubject");
    expect(execute).not.toHaveBeenCalled();
  });
  describe.each(["review_evidence", "update_action"] as const)(
    "%s subject lifecycle",
    (operation) => {
      const subjectId = "00000000-0000-4000-8000-000000000003";
      const ownerId = "00000000-0000-4000-8000-000000000004";
      const command =
        operation === "review_evidence"
          ? {
              operation,
              subjectId,
              id: actor.userId,
              version: 1,
              decision: "approved" as const,
              reason: "Confirmed current evidence",
              requestId: actor.tenantId,
            }
          : {
              operation,
              subjectId,
              id: actor.userId,
              version: 1,
              status: "in_progress" as const,
              objective: "Continue practice",
              ownerId,
              dueDate: null,
            };
      it("requires an explicit valid subject identity in the command contract", () => {
        expect(Value.Check(competenciesCommandSchema, command)).toBe(true);
        const { subjectId: _subjectId, ...withoutSubject } = command;
        expect(Value.Check(competenciesCommandSchema, withoutSubject)).toBe(false);
        expect(Value.Check(competenciesCommandSchema, { ...command, subjectId: "invalid" })).toBe(
          false,
        );
      });
      it.each(["archived", "deleted", "unknown"])(
        "rejects an %s subject before forwarding the command",
        async (state) => {
          const { service, repository, execute } = setup();
          repository.people.mockResolvedValue([
            { id: ownerId, archived: false },
            ...(state === "archived" ? [{ id: subjectId, archived: true }] : []),
          ]);
          await expect(service.execute(actor, command)).rejects.toThrow("invalidSubject");
          expect(repository.people).toHaveBeenCalledWith(
            operation === "review_evidence" ? [subjectId] : [subjectId, ownerId],
          );
          expect(execute).not.toHaveBeenCalled();
        },
      );
      it("forwards commands for an active subject with the trusted actor context", async () => {
        const { service, repository, execute } = setup();
        repository.people.mockResolvedValue([
          { id: subjectId, archived: false },
          { id: ownerId, archived: false },
        ]);
        await expect(service.execute(actor, command)).resolves.toEqual({ id: "saved" });
        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({ userId: actor.userId }),
          command,
        );
      });
    },
  );
  it("validates condition verifiers against current core users before saving", async () => {
    const { service, repository, execute } = setup();
    const command = {
      operation: "save_competency" as const,
      value: {
        name: "Communication",
        description: "",
        category: "Interpersonal",
        levels: [
          {
            id: "foundation",
            name: "Foundation",
            conditions: [
              {
                id: "conversation",
                kind: "observation" as const,
                description: "Explain the task",
                verifierIds: [actor.userId],
              },
            ],
          },
        ],
      },
    };
    await expect(service.execute(actor, command)).rejects.toThrow("invalidSubject");
    expect(execute).not.toHaveBeenCalled();
    repository.people.mockResolvedValue([{ id: actor.userId, archived: false }]);
    await expect(service.execute(actor, command)).resolves.toEqual({ id: "saved" });
    expect(repository.people).toHaveBeenCalledWith([actor.userId]);
  });
  it("refreshes learning facts on demand only after the plugin authorizes the visible subjects", async () => {
    const { service, workspace, syncService, repository } = setup();
    repository.people.mockResolvedValue([{ id: "permitted", archived: false }]);
    workspace.mockResolvedValue({
      catalog: [{ levels: [{ conditions: [{ kind: "course" }] }] }],
      verifiers: {},
      subjects: [],
      actions: [],
      evidence: [],
      revocations: [],
      standings: [{ subjectId: "permitted", standing: { competencyId: "competency" } }],
    });

    await service.workspace(actor, "en", "permitted");

    expect(syncService.refreshSubjects).toHaveBeenCalledWith(["permitted"]);
    expect(workspace).toHaveBeenCalledTimes(2);
  });
  it("never refreshes data for a subject rejected by the plugin", async () => {
    const { service, workspace, syncService, repository } = setup();
    repository.people.mockResolvedValue([{ id: "permitted", archived: false }]);
    workspace.mockRejectedValueOnce(new Error("Subject not found"));
    await expect(service.workspace(actor, "en", "permitted")).rejects.toThrow("Subject not found");
    expect(syncService.refreshSubjects).not.toHaveBeenCalled();
  });
  it("forwards a valid cross-team subject selection to the plugin for verifier authorization", async () => {
    const { service, workspace, repository } = setup();
    repository.people.mockResolvedValue([{ id: "peer", archived: false }]);
    await service.workspace(actor, "en", "peer");
    expect(repository.people).toHaveBeenNthCalledWith(1, ["peer"]);
    expect(workspace).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actor.userId, managedSubjectIds: ["permitted"] }),
      "peer",
      undefined,
      false,
      undefined,
    );
  });
  it("propagates the plugin denial for a valid subject the actor cannot read", async () => {
    const { service, workspace, repository } = setup();
    repository.people.mockResolvedValue([{ id: "peer", archived: false }]);
    workspace.mockRejectedValueOnce(new Error("Subject not found"));
    await expect(service.workspace(actor, "en", "peer")).rejects.toThrow("Subject not found");
    expect(workspace).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actor.userId }),
      "peer",
      undefined,
      false,
      undefined,
    );
  });
  it.each([
    ["unknown", []],
    ["archived", [{ id: "peer", archived: true }]],
  ])("rejects an %s explicit subject before plugin access", async (_state, people) => {
    const { service, workspace, repository } = setup();
    repository.people.mockResolvedValue(people as { id: string; archived: boolean }[]);
    await expect(service.workspace(actor, "en", "peer")).rejects.toThrow("invalidSubject");
    expect(workspace).not.toHaveBeenCalled();
  });
  it("keeps workspaces without digital requirements free of learning-source requests", async () => {
    const { service, syncService } = setup();
    await service.workspace(actor, "en");
    expect(syncService.refreshSubjects).not.toHaveBeenCalled();
  });
  it("rejects a missing attachment before reading file data or calling the plugin", async () => {
    const { service, execute } = setup();
    await expect(
      service.uploadAttachment(actor, actor.userId, actor.userId, undefined),
    ).rejects.toThrow("files.toast.invalidData");
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects an MP4 attachment before calling the plugin upload", async () => {
    const { service, repository, client, uploadAttachment } = setup();
    repository.people.mockResolvedValue([{ id: actor.userId, archived: false }]);
    const getFileType = jest.spyOn(FileGuard, "getFileType").mockResolvedValue(undefined);
    const file = {
      originalname: "recording.mp4",
      mimetype: "video/mp4",
      buffer: Buffer.from("not an mp4 file"),
      size: 15,
    } as Express.Multer.File;

    try {
      await expect(
        service.uploadAttachment(actor, actor.userId, actor.userId, file),
      ).rejects.toThrow("is not allowed");
    } finally {
      getFileType.mockRestore();
    }

    expect(client.run).not.toHaveBeenCalled();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });
  it("passes the authenticated actor separately from the command", async () => {
    const { service, execute } = setup();
    await service.execute(actor, { operation: "settings", warningDays: null });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actor.userId, canManage: false }),
      { operation: "settings", warningDays: null },
    );
  });
  it("allows condition overrides only for current competency managers", async () => {
    const { service, repository, execute, userService } = setup();
    const command = {
      operation: "set_condition_override" as const,
      requestId: actor.userId,
      subjectId: "permitted",
      competencyId: actor.userId,
      revision: 3,
      conditionId: "manual-review",
      status: "met" as const,
      comment: "Reviewed with the learner",
    };
    repository.people.mockResolvedValue([{ id: "permitted", archived: false }]);
    await expect(service.execute(actor, command)).rejects.toThrow("missingPermission");
    expect(execute).not.toHaveBeenCalled();
    const admin = {
      ...actor,
      permissions: [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.COMPETENCIES_MANAGE],
    };
    userService.getPermissionsForRoleSlugs.mockResolvedValue(admin.permissions);
    await expect(service.execute(admin, command)).resolves.toEqual({ id: "saved" });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ canManage: true }), command);
  });
});
