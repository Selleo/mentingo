import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { renderWith } from "~/utils/testUtils";

import { CompetenciesReview } from "./CompetenciesReview";

import type { CompetenciesWorkspace } from "../competencies.types";

vi.mock("~/api/mutations/useExecuteCompetenciesCommand");
vi.mock("~/api/queries/useCompetencyRecords");
vi.mock("~/api/mutations/useDownloadCompetenciesAttachment", () => ({
  useDownloadCompetenciesAttachment: () => ({ mutateAsync: vi.fn() }),
}));

describe("CompetenciesReview", () => {
  const workspace = {
    people: [{ id: "colleague", name: "Colleague", archived: false }],
    catalog: [
      {
        id: "skill",
        name: "Skill",
        archived: false,
        levels: [
          {
            conditions: [
              {
                id: "observation",
                kind: "observation",
                description: "Observe",
                verifierIds: ["verifier"],
              },
            ],
          },
        ],
      },
    ],
    evidence: [
      {
        id: "evidence",
        subjectId: "colleague",
        competencyId: "skill",
        conditionIds: ["observation"],
        status: "pending",
        version: 1,
        occurredAt: "2026-10-21T00:00:00Z",
        note: "Observed",
        attachmentId: "attachment",
      },
    ],
  } as unknown as CompetenciesWorkspace;
  function setup(value = workspace) {
    vi.mocked(useCompetencyRecords).mockImplementation(
      (query) =>
        ({
          data: {
            actions: [],
            evidence: query?.kind === "review-pending" ? value.evidence : [],
            total: query?.kind === "review-pending" ? value.evidence.length : 0,
          },
          isPending: false,
          isError: false,
        }) as unknown as ReturnType<typeof useCompetencyRecords>,
    );
    const execute = vi.fn().mockResolvedValue({ id: "evidence" });
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: execute,
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const onSubject = vi.fn();
    return {
      execute,
      onSubject,
      ...renderWith().render(
        <CompetenciesReview workspace={value} userId="verifier" onSubject={onSubject} />,
      ),
    };
  }
  it("opens an authorized active subject from a verifier's review row", async () => {
    const { onSubject } = setup();
    await userEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onSubject).toHaveBeenCalledWith("colleague");
  });
  it("puts only pending evidence first and pages completed reviews below without disclosures", async () => {
    const { rerender } = setup();
    vi.mocked(useCompetencyRecords).mockImplementation(
      (query) =>
        ({
          data: {
            actions: [],
            evidence: [
              {
                ...workspace.evidence[0],
                id: query?.kind,
                status: query?.kind === "review-pending" ? "pending" : "approved",
                note: query?.kind === "review-pending" ? "Waiting for review" : "Already reviewed",
              },
            ],
            total: query?.kind === "review-pending" ? 1 : 21,
          },
          isPending: false,
          isError: false,
        }) as unknown as ReturnType<typeof useCompetencyRecords>,
    );
    rerender(<CompetenciesReview workspace={workspace} userId="verifier" onSubject={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: "Pending Approval" })).not.toBeInTheDocument();
    expect(document.querySelector("details, summary")).toBeNull();
    const pending = screen.getByRole("region", { name: "Pending Approval" });
    const history = screen.getByRole("region", { name: "Evidence history" });
    expect(pending).toHaveTextContent("Waiting for review");
    expect(pending).not.toHaveTextContent("Already reviewed");
    expect(history).toHaveTextContent("Already reviewed");
    await userEvent.click(within(history).getAllByRole("button", { name: "Next" })[0]);
    expect(useCompetencyRecords).toHaveBeenLastCalledWith({
      kind: "review-history",
      page: "2",
      pageSize: "10",
    });
  });
  it("does not offer decisions for the verifier's own qualification", () => {
    setup({
      ...workspace,
      evidence: workspace.evidence.map((item) => ({ ...item, subjectId: "verifier" })),
    });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByText("Observed")).not.toBeInTheDocument();
  });
  it.each(["archived", "unknown"])(
    "retains %s subject history and download without decision controls",
    (state) => {
      setup({
        ...workspace,
        people:
          state === "archived"
            ? [{ id: "colleague", name: "Colleague", archived: true, canPlan: false }]
            : [],
      });
      expect(screen.getByText("Observed")).toBeVisible();
      expect(screen.getByRole("button", { name: "Download attachment" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "View details" })).not.toBeInTheDocument();
      for (const name of ["Approve", "Reject", "Revoke"])
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    },
  );
  it("binds a review decision to the displayed active subject", async () => {
    const { execute } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.type(screen.getByLabelText("Reason"), "Observed and confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "review_evidence",
        id: "evidence",
        subjectId: "colleague",
        decision: "approved",
      }),
    );
  });
  it("closes decision controls when the subject becomes inactive during review", async () => {
    const { rerender } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    rerender(
      <CompetenciesReview
        workspace={{ ...workspace, people: [] }}
        userId="verifier"
        onSubject={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
