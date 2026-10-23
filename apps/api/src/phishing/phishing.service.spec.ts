import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS } from "@repo/shared";

import { PhishingService } from "./phishing.service";

import type { PhishingClientService } from "./phishing-client.service";
import type { PhishingRepository } from "./phishing.repository";
import type { CreatePhishingCampaign } from "./phishing.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
describe("Phishing service access", () => {
  const manager: CurrentUserType = {
    userId: "manager",
    tenantId: "tenant",
    email: "manager@example.test",
    permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ, PERMISSIONS.PHISHING_REPORT_READ],
    roleSlugs: [],
  };
  const admin: CurrentUserType = {
    ...manager,
    permissions: [PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ],
  };
  const totals = (recipients: number, risky = 0) => ({
    recipients,
    sent: recipients,
    clicked: risky,
    submitted: 0,
    risky,
  });
  const setup = () => {
    const recipient = {
      userId: "visible",
      email: "user@example.test",
      firstName: "Test",
      lastName: "User",
      groupIds: ["visible-group", "private-group"],
      sentAt: "now",
      clickedAt: "now",
      submittedAt: null,
      failed: false,
    };
    const api = {
      scenarios: {
        list: jest.fn().mockResolvedValue([{ id: "reminder", action: "clicked" }]),
      },
      campaigns: {
        get: jest.fn().mockResolvedValue({ id: "campaign", courseId: "course" }),
      },
      reports: {
        summary: jest.fn().mockResolvedValue({
          campaign: { id: "campaign", courseId: "course", scenarioId: "reminder" },
          totals: totals(1, 1),
          groups: [
            { id: "visible-group", totals: totals(1, 1) },
            { id: "other-group", totals: totals(3) },
          ],
          activity: [],
        }),
        recipients: jest.fn().mockResolvedValue({
          recipients: [recipient],
          pagination: { page: 1, perPage: 20, totalItems: 1 },
        }),
      },
    };
    const client = { run: jest.fn((fn: (value: typeof api) => unknown) => fn(api)) };
    const repository = {
      groups: jest.fn().mockResolvedValue([{ id: "visible-group", name: "Visible" }]),
      enrollment: jest
        .fn()
        .mockResolvedValue([
          { userId: "visible", status: COURSE_ENROLLMENT.ENROLLED, progress: "in_progress" },
        ]),
    };
    return {
      service: new PhishingService(
        client as unknown as PhishingClientService,
        repository as unknown as PhishingRepository,
      ),
      api,
      repository,
      client,
    };
  };
  it("asks the plugin for a manager's groups only and names the visible ones", async () => {
    const { service, api } = setup();
    const report = await service.report("campaign", manager, "en");
    expect(api.reports.summary).toHaveBeenCalledWith("campaign", { groupIds: ["visible-group"] });
    expect(report.totals).toMatchObject({ recipients: 1, risky: 1, riskRate: 100 });
    expect(report.riskyAction).toBe("clicked");
    expect(report.groups).toEqual([
      { id: "visible-group", name: "Visible", totals: { ...totals(1, 1), riskRate: 100 } },
    ]);
  });
  it("does not scope administrators", async () => {
    const { service, api } = setup();
    await service.report("campaign", admin, "en");
    expect(api.reports.summary).toHaveBeenCalledWith("campaign", { groupIds: undefined });
  });
  it("returns not found for campaigns outside a manager's scope", async () => {
    const { service, repository, api } = setup();
    repository.groups.mockResolvedValue([]);
    await expect(service.report("campaign", manager, "en")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.reportRecipients("campaign", manager, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(api.reports.summary).not.toHaveBeenCalled();
    api.reports.summary.mockResolvedValue({ totals: totals(0), groups: [], activity: [] });
    repository.groups.mockResolvedValue([{ id: "visible-group", name: "Visible" }]);
    await expect(service.report("campaign", manager, "en")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it("forwards the query with the manager's scope and adds course progress to the page", async () => {
    const { service, api, repository } = setup();
    const page = await service.reportRecipients("campaign", manager, {
      search: "test",
      filter: "atRisk",
      sort: "-clickedAt",
      page: 1,
    });
    expect(api.reports.recipients).toHaveBeenCalledWith("campaign", {
      search: "test",
      filter: "atRisk",
      sort: "-clickedAt",
      page: 1,
      groupIds: ["visible-group"],
    });
    expect(repository.enrollment).toHaveBeenCalledWith("course", ["visible"]);
    expect(page.data).toEqual([
      expect.objectContaining({ groupIds: ["visible-group"], courseStatus: "in_progress" }),
    ]);
    expect(page.pagination.totalItems).toBe(1);
  });
  it("hides whether a campaign exists when a manager's filtered page is empty", async () => {
    const { service, api } = setup();
    api.reports.recipients.mockResolvedValue({
      recipients: [],
      pagination: { page: 1, perPage: 20, totalItems: 0 },
    });
    await expect(
      service.reportRecipients("campaign", manager, { search: "nobody" }),
    ).resolves.toMatchObject({ data: [] });
    api.reports.summary.mockResolvedValue({ totals: totals(0), groups: [], activity: [] });
    await expect(service.reportRecipients("campaign", manager, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it("requires course-enrollment permission before creating a campaign", async () => {
    const { service, client } = setup();
    await expect(service.create({} as CreatePhishingCampaign, manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.run).not.toHaveBeenCalled();
  });
});
