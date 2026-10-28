import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { FileGuard } from "src/file/guards/file.guard";

import { CompetenciesService } from "./competencies.service";
import {
  competenciesCommandSchema,
  competencyPeopleQuerySchema,
} from "./schemas/competencies.schema";

import type { CompetenciesClientService } from "./competencies-client.service";
import type { CompetenciesPeopleSyncService } from "./competencies-people-sync.service";
import type { CompetenciesSyncService } from "./competencies-sync.service";
import type { CompetenciesContextRepository } from "./repositories/competencies-context.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { UserService } from "src/user/user.service";

const SUBJECT_ID = "00000000-0000-4000-8000-000000000003";
const VERIFIER_ID = "00000000-0000-4000-8000-000000000004";
const COURSE_ID = "00000000-0000-4000-8000-000000000005";

describe("CompetenciesService", () => {
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "manager@example.test",
    roleSlugs: [],
    permissions: [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
  };
  const emptySubject = {
    asOf: "2026-10-28T00:00:00.000Z",
    warningDays: null,
    person: null,
    profile: null,
    assessment: null,
    competencies: [],
    standings: [],
    evidence: [],
    overrides: [],
    revocations: [],
  };

  function setup() {
    const attachment = {
      body: { cancel: jest.fn() },
      contentType: "application/pdf",
      contentDisposition: "attachment",
    };
    const sdk = {
      execute: jest.fn().mockResolvedValue({ id: "saved" }),
      people: jest.fn().mockResolvedValue({ data: [] }),
      catalog: jest.fn().mockResolvedValue({ data: [] }),
      subject: jest.fn().mockResolvedValue(emptySubject),
      configuration: jest
        .fn()
        .mockResolvedValue({ capabilities: { competencies: { enabled: true } } }),
      uploadAttachment: jest.fn().mockResolvedValue({ id: "attachment" }),
      downloadAttachment: jest.fn().mockResolvedValue(attachment),
    };
    const client = { requestWithClient: jest.fn(async (operation) => operation(sdk)) };
    const repository = {
      findManagedSubjects: jest.fn().mockResolvedValue([{ id: "b-managed" }, { id: "a-managed" }]),
      findPeople: jest
        .fn()
        .mockResolvedValue([{ id: SUBJECT_ID, name: "Ann Lee", archived: false }]),
      courseExists: jest.fn().mockResolvedValue(true),
      findAvailableCourses: jest.fn().mockResolvedValue([]),
      findActorIdentity: jest.fn().mockResolvedValue({
        userId: actor.userId,
        tenantId: actor.tenantId,
        email: actor.email,
        roleSlugs: actor.roleSlugs,
      }),
    };
    const userService = {
      getPermissionsForRoleSlugs: jest.fn().mockResolvedValue(actor.permissions),
    };
    const syncService = { reconcileSubjectLearningFacts: jest.fn() };
    const peopleSyncService = {
      syncTenantPeopleIfStale: jest.fn(),
      syncSubjectPeople: jest.fn(),
    };
    return {
      service: new CompetenciesService(
        client as unknown as CompetenciesClientService,
        repository as unknown as CompetenciesContextRepository,
        userService as unknown as UserService,
        syncService as unknown as CompetenciesSyncService,
        peopleSyncService as unknown as CompetenciesPeopleSyncService,
      ),
      sdk,
      repository,
      userService,
      syncService,
      peopleSyncService,
      attachment,
    };
  }

  describe("request contracts", () => {
    it("bounds people list pages", () => {
      const { perPage, readiness } = competencyPeopleQuerySchema.properties;
      expect(Value.Check(perPage, 100)).toBe(true);
      expect(Value.Check(perPage, 1000)).toBe(false);
      expect(Value.Check(readiness, "met")).toBe(true);
      expect(Value.Check(readiness, "raw-sql")).toBe(false);
    });

    it("rejects overrides that force an unmet result", () => {
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

    it("accepts only course, document and observation conditions", () => {
      const command = (kind: string) => ({
        operation: "save_competency",
        value: {
          name: "Forklift",
          description: "",
          categoryId: null,
          levels: [{ id: "l1", name: "Basic", conditions: [{ id: "c1", kind, description: "d" }] }],
        },
      });
      expect(Value.Check(competenciesCommandSchema, command("observation"))).toBe(true);
      expect(Value.Check(competenciesCommandSchema, command("quiz"))).toBe(false);
    });
  });

  it("derives administration and a sorted team from current core permissions", async () => {
    const { service, userService } = setup();
    userService.getPermissionsForRoleSlugs.mockResolvedValue([
      ...actor.permissions,
      PERMISSIONS.COMPETENCIES_MANAGE,
    ]);
    await expect(
      service.buildActorContext({
        ...actor,
        permissions: [...actor.permissions, PERMISSIONS.COMPETENCIES_MANAGE],
      }),
    ).resolves.toEqual({
      userId: actor.userId,
      canManage: true,
      managedSubjectIds: ["a-managed", "b-managed"],
      locale: "en",
    });
  });

  it("ignores permissions the user lost after the request was authenticated", async () => {
    const { service, userService } = setup();
    userService.getPermissionsForRoleSlugs.mockResolvedValue([]);
    await expect(service.buildActorContext(actor)).rejects.toThrow("missingPermission");
  });

  it("syncs people before listing them with default paging", async () => {
    const { service, sdk, peopleSyncService } = setup();
    await service.getPeople(actor, { search: "  ann ", teamOnly: "true" });
    expect(peopleSyncService.syncTenantPeopleIfStale).toHaveBeenCalled();
    expect(sdk.people).toHaveBeenCalledWith(expect.objectContaining({ userId: actor.userId }), {
      page: 1,
      perPage: 20,
      search: "ann",
      profileId: undefined,
      readiness: undefined,
      teamOnly: true,
    });
  });

  it("asks for uncategorized competencies with a null category", async () => {
    const { service, sdk } = setup();
    await service.getCatalog(actor, { categoryId: "none" });
    expect(sdk.catalog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ categoryId: null, archived: false }),
    );
  });

  describe("subject", () => {
    it("rejects archived people before calling the plugin", async () => {
      const { service, sdk, repository } = setup();
      repository.findPeople.mockResolvedValue([{ id: SUBJECT_ID, name: "Ann", archived: true }]);
      await expect(service.getSubjectCompetencies(actor, SUBJECT_ID, {})).rejects.toThrow(
        "invalidSubject",
      );
      expect(sdk.subject).not.toHaveBeenCalled();
    });

    it("reconciles course completions only when a shown competency needs a course", async () => {
      const { service, sdk, syncService } = setup();
      await service.getSubjectCompetencies(actor, SUBJECT_ID, {});
      expect(syncService.reconcileSubjectLearningFacts).not.toHaveBeenCalled();
      sdk.subject.mockResolvedValue({
        ...emptySubject,
        competencies: [
          {
            levels: [{ conditions: [{ id: "c", kind: "course", resourceId: COURSE_ID }] }],
          },
        ],
      });
      await service.getSubjectCompetencies(actor, SUBJECT_ID, {});
      expect(syncService.reconcileSubjectLearningFacts).toHaveBeenCalledWith([SUBJECT_ID]);
    });

    it("names the people who created and reviewed the person's evidence", async () => {
      const { service, sdk, repository } = setup();
      sdk.subject.mockResolvedValue({
        ...emptySubject,
        evidence: [{ createdBy: SUBJECT_ID, reviewedBy: VERIFIER_ID }],
      });
      repository.findPeople
        .mockResolvedValueOnce([{ id: SUBJECT_ID, name: "Ann Lee", archived: false }])
        .mockResolvedValueOnce([
          { id: SUBJECT_ID, name: "Ann Lee", archived: false },
          { id: VERIFIER_ID, name: "Vic Doe", archived: true },
        ]);
      const result = await service.getSubjectCompetencies(actor, SUBJECT_ID, {});
      expect(repository.findPeople).toHaveBeenLastCalledWith([SUBJECT_ID, VERIFIER_ID]);
      expect(result.people).toEqual([
        { id: SUBJECT_ID, name: "Ann Lee" },
        { id: VERIFIER_ID, name: "Vic Doe" },
      ]);
      expect(result.canPlan).toBe(false);
    });
  });

  describe("commands", () => {
    const evidenceCommand = {
      operation: "submit_evidence" as const,
      value: {
        requestId: actor.userId,
        subjectId: SUBJECT_ID,
        competencyId: actor.userId,
        conditionIds: ["condition"],
        kind: "recognition" as const,
        occurredAt: new Date().toISOString(),
        validUntil: null,
        note: "Recognized",
      },
    };

    it("rejects archived or unknown subjects before forwarding", async () => {
      const { service, sdk, repository } = setup();
      repository.findPeople.mockResolvedValue([{ id: SUBJECT_ID, archived: true }]);
      await expect(service.executeCompetenciesCommand(actor, evidenceCommand)).rejects.toThrow(
        "invalidSubject",
      );
      repository.findPeople.mockResolvedValue([]);
      await expect(service.executeCompetenciesCommand(actor, evidenceCommand)).rejects.toThrow(
        "invalidSubject",
      );
      expect(sdk.execute).not.toHaveBeenCalled();
    });

    it("syncs the subject and forwards the trusted actor separately from the command", async () => {
      const { service, sdk, peopleSyncService } = setup();
      await expect(service.executeCompetenciesCommand(actor, evidenceCommand)).resolves.toEqual({
        id: "saved",
      });
      expect(peopleSyncService.syncSubjectPeople).toHaveBeenCalledWith([SUBJECT_ID]);
      expect(sdk.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: actor.userId }),
        evidenceCommand,
      );
    });

    it("validates verifiers and courses against core before saving a competency", async () => {
      const { service, sdk, repository } = setup();
      const command = {
        operation: "save_competency" as const,
        value: {
          name: "Forklift",
          description: "",
          categoryId: null,
          levels: [
            {
              id: "l1",
              name: "Basic",
              conditions: [
                { id: "c1", kind: "course" as const, description: "Course", resourceId: COURSE_ID },
                {
                  id: "c2",
                  kind: "observation" as const,
                  description: "Observed",
                  verifierIds: [VERIFIER_ID],
                },
              ],
            },
          ],
        },
      };
      repository.findPeople.mockResolvedValue([]);
      await expect(service.executeCompetenciesCommand(actor, command)).rejects.toThrow(
        "invalidSubject",
      );
      repository.findPeople.mockResolvedValue([{ id: VERIFIER_ID, archived: false }]);
      repository.courseExists.mockResolvedValue(false);
      await expect(service.executeCompetenciesCommand(actor, command)).rejects.toThrow(
        "invalidResource",
      );
      expect(sdk.execute).not.toHaveBeenCalled();
      repository.courseExists.mockResolvedValue(true);
      await service.executeCompetenciesCommand(actor, command);
      expect(sdk.execute).toHaveBeenCalled();
    });

    it("allows condition overrides only for competency administrators", async () => {
      const { service, sdk } = setup();
      await expect(
        service.executeCompetenciesCommand(actor, {
          operation: "set_condition_override",
          requestId: actor.userId,
          subjectId: SUBJECT_ID,
          competencyId: actor.userId,
          revision: 1,
          conditionId: "c1",
          status: "met",
          comment: "Confirmed elsewhere",
        }),
      ).rejects.toThrow("missingPermission");
      expect(sdk.execute).not.toHaveBeenCalled();
    });
  });

  describe("attachments", () => {
    it("rejects a missing file before calling the plugin", async () => {
      const { service, sdk } = setup();
      await expect(
        service.uploadAttachment(actor, SUBJECT_ID, actor.userId, undefined),
      ).rejects.toThrow("invalidData");
      expect(sdk.uploadAttachment).not.toHaveBeenCalled();
    });

    it("rejects an unsupported file type before calling the plugin", async () => {
      const { service, sdk } = setup();
      const validateFile = jest
        .spyOn(FileGuard, "validateFile")
        .mockRejectedValue(new Error("files.toast.invalidType"));
      await expect(
        service.uploadAttachment(actor, SUBJECT_ID, actor.userId, {
          originalname: "video.mp4",
          mimetype: "video/mp4",
          buffer: Buffer.from("video"),
        } as Express.Multer.File),
      ).rejects.toThrow("invalidType");
      expect(sdk.uploadAttachment).not.toHaveBeenCalled();
      validateFile.mockRestore();
    });

    it("cancels a download when core access disappears before delivery", async () => {
      const { service, userService, attachment } = setup();
      userService.getPermissionsForRoleSlugs
        .mockResolvedValueOnce(actor.permissions)
        .mockResolvedValue([]);
      await expect(service.downloadAttachment(actor, "file")).rejects.toThrow("missingPermission");
      expect(attachment.body.cancel).toHaveBeenCalledTimes(1);
    });

    it("cancels a download when the plugin is disabled during retrieval", async () => {
      const { service, sdk, attachment } = setup();
      sdk.configuration.mockResolvedValue({ capabilities: { competencies: { enabled: false } } });
      await expect(service.downloadAttachment(actor, "file")).rejects.toThrow("conflict");
      expect(attachment.body.cancel).toHaveBeenCalledTimes(1);
    });
  });
});
