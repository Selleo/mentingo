import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { renderWith } from "~/utils/testUtils";

import { CompetenciesDocuments } from "./CompetenciesDocuments";

import type { CompetenciesWorkspace } from "../competencies.types";

const { execute, upload } = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue({}),
  upload: vi.fn().mockResolvedValue({ id: "file" }),
}));
vi.mock("~/api/mutations/useExecuteCompetenciesCommand", () => ({
  useExecuteCompetenciesCommand: () => ({ mutateAsync: execute, isPending: false }),
}));
vi.mock("~/api/mutations/useUploadCompetenciesAttachment", () => ({
  useUploadCompetenciesAttachment: () => ({ mutateAsync: upload, isPending: false }),
}));
vi.mock("~/api/mutations/useDownloadCompetenciesAttachment", () => ({
  useDownloadCompetenciesAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/api/queries/useCompetencyRecords", () => ({
  useCompetencyRecords: vi.fn(() => ({
    data: { evidence: [], actions: [], total: 0 },
    isPending: false,
    isError: false,
  })),
}));

const competency = {
  id: "teamwork",
  name: "Teamwork",
  levels: [
    {
      id: "l1",
      name: "Foundation",
      conditions: [
        { id: "portfolio", kind: "document", description: "Provide a handover example" },
        { id: "observed", kind: "observation", description: "Coordinate a handover" },
      ],
    },
  ],
};
function workspace(pending = false, canPlan = false) {
  return {
    catalog: [competency],
    people: [{ id: "employee", archived: false, canPlan }],
    actions: [],
    standings: [],
    evidence: [],
    assessments: [
      {
        subjectId: "employee",
        requirements: [
          {
            requirement: { competencyId: "teamwork", levelId: "l1" },
            standing: {
              levels: [
                {
                  levelId: "l1",
                  conditions: [
                    {
                      conditionId: "portfolio",
                      met: false,
                      reason: pending ? "pending" : "missing",
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  } as unknown as CompetenciesWorkspace;
}
describe("Required document submissions", () => {
  beforeEach(() =>
    vi.mocked(useCompetencyRecords).mockReturnValue({
      data: { evidence: [], actions: [], total: 0 },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCompetencyRecords>),
  );
  it("makes document submission visible without expanding a plan and derives its type", async () => {
    execute.mockClear();
    upload.mockClear();
    renderWith().render(
      <CompetenciesDocuments workspace={workspace()} subjectId="employee" userId="employee" />,
    );
    expect(screen.getByText("Provide a handover example")).toBeVisible();
    expect(screen.queryByText("Coordinate a handover")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit document" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("combobox", { name: "Condition type" }),
    ).not.toBeInTheDocument();
    expect(dialog.querySelector('input[type="datetime-local"]')).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Fulfilled on (optional)" }));
    expect(screen.getByRole("grid")).toBeVisible();
    await userEvent.click(
      within(screen.getByRole("grid")).getByText("15", { selector: "button", exact: true }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Fulfilled on (optional)" }));
    expect(dialog).toBeVisible();
    await userEvent.type(within(dialog).getByLabelText("Note"), "Handover reviewed");
    await userEvent.upload(
      within(dialog).getByLabelText("Attachment (optional)"),
      new File(["evidence"], "handover.png", { type: "image/png" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    expect(execute).toHaveBeenCalledWith({
      operation: "submit_evidence",
      value: expect.objectContaining({
        subjectId: "employee",
        competencyId: "teamwork",
        conditionIds: ["portfolio"],
        kind: "document",
        attachmentId: "file",
        note: "Handover reviewed",
        occurredAt: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString(),
      }),
    });
  });
  it("shows pending review and prevents a duplicate pending submission", () => {
    renderWith().render(
      <CompetenciesDocuments workspace={workspace(true)} subjectId="employee" userId="employee" />,
    );
    expect(screen.getByText("Pending review")).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit document" })).toBeDisabled();
  });
  it("offers renewal documents at the current level even above the job requirement", async () => {
    const value = workspace();
    value.catalog[0].levels.push({
      id: "l2",
      name: "Independent",
      conditions: [
        { id: "renewal", kind: "document", description: "Provide a recent teamwork example" },
      ],
    });
    const standing = {
      competencyId: "teamwork",
      currentLevelId: "l2",
      expiring: true,
      levels: [
        {
          levelId: "l1",
          met: true,
          conditions: [{ conditionId: "portfolio", met: true, reason: null }],
        },
        {
          levelId: "l2",
          met: true,
          conditions: [{ conditionId: "renewal", met: true, reason: null }],
        },
      ],
    } as unknown as CompetenciesWorkspace["standings"][number]["standing"];
    value.standings = [{ subjectId: "employee", standing }];
    value.assessments[0].requirements[0].standing = standing;
    const { rerender } = renderWith().render(
      <CompetenciesDocuments workspace={value} subjectId="employee" userId="employee" />,
    );
    const renewal = screen.getByText("Provide a recent teamwork example").closest("li")!;
    expect(within(renewal).getByRole("button", { name: "Submit document" })).toBeEnabled();
    expect(screen.getAllByText("Provide a handover example")).toHaveLength(1);
    value.evidence = [
      {
        id: "pending",
        subjectId: "employee",
        competencyId: "teamwork",
        kind: "document",
        status: "pending",
        conditionIds: ["renewal"],
        occurredAt: "2026-10-21T10:00:00Z",
      },
    ] as unknown as CompetenciesWorkspace["evidence"];
    rerender(<CompetenciesDocuments workspace={value} subjectId="employee" userId="employee" />);
    expect(within(renewal).getByRole("button", { name: "Submit document" })).toBeDisabled();
    value.standings[0].standing.expiring = false;
    rerender(<CompetenciesDocuments workspace={value} subjectId="employee" userId="employee" />);
    expect(screen.queryByText("Provide a recent teamwork example")).not.toBeInTheDocument();
  });
  it("hides previous submissions from the employee while retaining the manager history", () => {
    const value = workspace(false, true);
    value.evidence = [
      {
        id: "old",
        subjectId: "employee",
        competencyId: "teamwork",
        kind: "document",
        status: "approved",
        note: "Previous handover example",
        occurredAt: "2026-10-01T10:00:00Z",
      },
    ] as unknown as CompetenciesWorkspace["evidence"];
    const { rerender } = renderWith().render(
      <CompetenciesDocuments workspace={value} subjectId="employee" userId="employee" />,
    );
    expect(screen.queryByText("Previous handover example")).not.toBeInTheDocument();
    vi.mocked(useCompetencyRecords).mockReturnValue({
      data: { evidence: value.evidence, actions: [], total: 1 },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCompetencyRecords>);
    rerender(<CompetenciesDocuments workspace={value} subjectId="employee" userId="manager" />);
    expect(screen.getByText("Previous handover example")).toBeVisible();
  });
  it("requests another document page instead of rendering all submissions", async () => {
    vi.mocked(useCompetencyRecords).mockReturnValue({
      data: { evidence: [], actions: [], total: 21 },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCompetencyRecords>);
    renderWith().render(
      <CompetenciesDocuments
        workspace={workspace(false, true)}
        subjectId="employee"
        userId="manager"
      />,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
    expect(useCompetencyRecords).toHaveBeenLastCalledWith(
      { kind: "documents", subjectId: "employee", page: "2", pageSize: "10" },
      true,
    );
  });
  it.each([
    { userId: "manager", canPlan: true, allowed: true },
    { userId: "verifier", canPlan: false, allowed: false },
  ])("applies document-submission access for $userId", ({ userId, canPlan, allowed }) => {
    renderWith().render(
      <CompetenciesDocuments
        workspace={workspace(false, canPlan)}
        subjectId="employee"
        userId={userId}
      />,
    );
    expect(Boolean(screen.queryByRole("button", { name: "Submit document" }))).toBe(allowed);
  });
});
