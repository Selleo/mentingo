import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { PhishingService } from "./phishing.service";

import type { PhishingClientService } from "./phishing-client.service";
import type { PhishingRepository } from "./phishing.repository";
import type { CreatePhishingCampaign } from "./phishing.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
describe("Phishing service access", () => {
  const actor: CurrentUserType = {
    userId: "manager",
    tenantId: "tenant",
    email: "manager@example.test",
    permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ, PERMISSIONS.PHISHING_REPORT_READ],
    roleSlugs: [],
  };
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
    const client = {
      run: jest.fn().mockResolvedValue({
        campaign: { id: "campaign", courseId: "course" },
        recipients: [recipient, { ...recipient, userId: "hidden", groupIds: ["private-group"] }],
      }),
    };
    const repository = {
      groups: jest.fn().mockResolvedValue([{ id: "visible-group", name: "Visible" }]),
      enrollment: jest.fn().mockResolvedValue([]),
    };
    return {
      service: new PhishingService(
        client as unknown as PhishingClientService,
        repository as unknown as PhishingRepository,
      ),
      repository,
      client,
    };
  };
  it("scopes people, memberships, totals and course lookups before returning a manager report", async () => {
    const { service, repository } = setup();
    const report = await service.report("campaign", actor, "en");
    expect(report.recipients).toHaveLength(1);
    expect(report.recipients[0].groupIds).toEqual(["visible-group"]);
    expect(report.totals.recipients).toBe(1);
    expect(repository.enrollment).toHaveBeenCalledWith("course", ["visible"]);
  });
  it("returns not found for campaigns outside a manager's scope", async () => {
    const { service, repository } = setup();
    repository.groups.mockResolvedValue([]);
    await expect(service.report("campaign", actor, "en")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.enrollment).not.toHaveBeenCalled();
  });
  it("requires course-enrollment permission before creating a campaign", async () => {
    const { service, client } = setup();
    await expect(service.create({} as CreatePhishingCampaign, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.run).not.toHaveBeenCalled();
  });
});
