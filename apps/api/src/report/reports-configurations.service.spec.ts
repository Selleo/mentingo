import { PERMISSIONS } from "@repo/shared";

import { REPORT_FAILURE_CODE } from "./constants/reports.constants";
import { REPORT_ERRORS } from "./constants/reports.errors";
import { ReportsConfigurationsService } from "./reports-configurations.service";

import type { ReportsQueryService } from "./reports-query.service";
import type { ReportsConfigurationsRepository } from "./repositories/reports-configurations.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

const actor: CurrentUserType = {
  userId: "0f36e00a-5944-4f6c-b468-e1c2705a0ec9",
  tenantId: "3f186e0a-5944-4f6c-b468-e1c2705a0ec9",
  email: "reporter@example.com",
  roleSlugs: [],
  permissions: [PERMISSIONS.REPORT_READ, PERMISSIONS.COURSE_UPDATE_OWN],
};

const query = {
  view: "organisation" as const,
  timezone: "UTC",
  groupIds: [],
};

const makeService = (
  configurations: Partial<ReportsConfigurationsRepository>,
  reportsQuery: Partial<ReportsQueryService>,
) =>
  new ReportsConfigurationsService(
    configurations as ReportsConfigurationsRepository,
    reportsQuery as ReportsQueryService,
  );

describe("ReportsConfigurationsService", () => {
  it("rejects shared configuration creation for own-course reporters", async () => {
    const repository = { create: jest.fn() };
    const reportsQuery = { validateReportAccess: jest.fn() };
    const service = makeService(repository, reportsQuery);

    await expect(
      service.createConfiguration({ name: "Team progress", visibility: "shared", query }, actor),
    ).rejects.toMatchObject({ message: REPORT_ERRORS.CONFIGURATION_SHARED_MANAGEMENT_FORBIDDEN });

    expect(repository.create).not.toHaveBeenCalled();
    expect(reportsQuery.validateReportAccess).not.toHaveBeenCalled();
  });

  it("keeps an owned saved view visible with a clear unavailable state after access narrows", async () => {
    const row = {
      id: "4b632420-18ee-4c2a-87b4-509ad413a190",
      tenantId: actor.tenantId,
      ownerId: actor.userId,
      name: "Former group",
      visibility: "personal" as const,
      query,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const repository = {
      findVisibleWithAvailability: jest.fn().mockResolvedValue([
        {
          ...row,
          isAvailable: false,
          failureCode: REPORT_FAILURE_CODE.INACCESSIBLE_REFERENCE,
        },
      ]),
    };
    const reportsQuery = { validateReportAccess: jest.fn() };
    const service = makeService(repository, reportsQuery);

    await expect(service.listConfigurations(actor)).resolves.toEqual([
      { ...row, isAvailable: false, failureCode: REPORT_FAILURE_CODE.INACCESSIBLE_REFERENCE },
    ]);
    expect(repository.findVisibleWithAvailability).toHaveBeenCalledTimes(1);
    expect(reportsQuery.validateReportAccess).not.toHaveBeenCalled();
  });

  it("propagates repository failures instead of mislabeling them as unavailable references", async () => {
    const databaseError = new Error("database unavailable");
    const service = makeService(
      {
        findVisibleWithAvailability: jest.fn().mockRejectedValue(databaseError),
      },
      {},
    );

    await expect(service.listConfigurations(actor)).rejects.toBe(databaseError);
  });

  it("requires a non-whitespace name before saving a configuration", async () => {
    const repository = { create: jest.fn() };
    const reportsQuery = { validateReportAccess: jest.fn() };
    const service = makeService(repository, reportsQuery);

    await expect(
      service.createConfiguration({ name: "   ", visibility: "personal", query }, actor),
    ).rejects.toMatchObject({ message: REPORT_ERRORS.CONFIGURATION_NAME_REQUIRED });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
