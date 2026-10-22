import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { renderWith } from "~/utils/testUtils";

import { CompetenciesActionEditor, CompetenciesPlans } from "./CompetenciesPlans";

import type { CompetenciesWorkspace } from "../competencies.types";

vi.mock("~/api/mutations/useExecuteCompetenciesCommand");
vi.mock("~/api/queries/useCompetencyRecords", () => ({
  useCompetencyRecords: () => ({
    data: { actions: [], evidence: [], total: 0 },
    isPending: false,
    isError: false,
  }),
}));
const { assign } = vi.hoisted(() => ({ assign: vi.fn().mockResolvedValue({ id: "action" }) }));
vi.mock("~/api/mutations/useAssignCompetenciesLearning", () => ({
  useAssignCompetenciesLearning: () => ({ mutateAsync: assign, isPending: false }),
}));

describe("CompetenciesPlans", () => {
  const action = {
    id: "action",
    subjectId: "employee",
    competencyId: "competency",
    levelId: "foundation",
    version: 1,
    objective: "Retained practice",
    kind: "practice",
    status: "planned",
    ownerId: "manager",
    dueDate: null,
  };
  const workspace = {
    people: [
      { id: "employee", name: "Employee", archived: false, canPlan: true },
      { id: "manager", name: "Manager", archived: false, canPlan: true },
    ],
    actions: [action],
    catalog: [],
    standings: [],
    evidence: [],
    actionHistory: [],
    verifiers: {},
  } as unknown as CompetenciesWorkspace;
  it.each(["archived", "unknown"])(
    "keeps an %s subject's plan readable without editing controls",
    async (state) => {
      vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
      const inactiveWorkspace = {
        ...workspace,
        actions: [
          {
            ...workspace.actions[0],
            kind: "course" as const,
            courseId: "course",
            assignmentStatus: "not_requested" as const,
          },
        ],
        people:
          state === "archived"
            ? [{ id: "employee", name: "Employee", archived: true, canPlan: false }]
            : [],
      };
      renderWith().render(
        <MemoryRouter>
          <CompetenciesPlans
            workspace={inactiveWorkspace}
            subjectId="employee"
            userId="manager"
            canPlan
            canEnroll
          />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByRole("button", { name: "Retained practice" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("Retained practice");
      expect(within(dialog).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Submit evidence" }),
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Assign course" }),
      ).not.toBeInTheDocument();
    },
  );
  it("binds a course assignment request to the displayed active subject", async () => {
    assign.mockClear();
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    renderWith().render(
      <MemoryRouter>
        <CompetenciesPlans
          workspace={{
            ...workspace,
            actions: [
              {
                ...workspace.actions[0],
                kind: "course",
                courseId: "course",
                assignmentStatus: "not_requested",
                assignmentRequestId: null,
              },
            ],
          }}
          subjectId="employee"
          userId="manager"
          canPlan
          canEnroll
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retained practice" }));
    expect(screen.getByRole("dialog").querySelector("details, summary")).toBeNull();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Retained practice");
    await userEvent.click(screen.getByRole("button", { name: "Assign course" }));
    expect(assign).toHaveBeenCalledWith({
      id: "action",
      subjectId: "employee",
      requestId: expect.any(String),
    });
  });
  it("binds action edits to the active subject and disables a stale editor after archival", async () => {
    const execute = vi.fn().mockResolvedValue({ id: "action" });
    const close = vi.fn();
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: execute,
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const { rerender } = renderWith().render(
      <CompetenciesActionEditor
        workspace={workspace}
        subjectId="employee"
        userId="manager"
        action={workspace.actions[0]}
        close={close}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "update_action",
        id: "action",
        subjectId: "employee",
      }),
    );
    rerender(
      <CompetenciesActionEditor
        workspace={{ ...workspace, people: [] }}
        subjectId="employee"
        userId="manager"
        action={workspace.actions[0]}
        close={close}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it.each(["create", "edit"])(
    "selects and clears the due date with the shared calendar on %s",
    async (mode) => {
      const execute = vi.fn().mockResolvedValue({ id: "action" });
      vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
        mutateAsync: execute,
        isPending: false,
      } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
      const date = new Date();
      const initialDueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-10T00:00:00.000Z`;
      renderWith().render(
        <CompetenciesActionEditor
          workspace={
            {
              ...workspace,
              catalog: [
                {
                  id: "competency",
                  name: "Communication",
                  levels: [{ id: "foundation", name: "Foundation" }],
                },
              ],
              standings: [
                {
                  subjectId: "employee",
                  standing: {
                    competencyId: "competency",
                    levels: [{ levelId: "foundation", met: false }],
                  },
                },
              ],
            } as unknown as CompetenciesWorkspace
          }
          subjectId="employee"
          userId="manager"
          action={
            mode === "edit" ? { ...workspace.actions[0], dueDate: initialDueDate } : undefined
          }
          close={vi.fn()}
        />,
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog.querySelector('input[type="date"]')).toBeNull();
      const dateButton = within(dialog).getByRole("button", { name: "Due date (optional)" });
      if (mode === "edit") expect(dateButton).toHaveTextContent("10");
      else
        await userEvent.type(within(dialog).getByLabelText("Objective"), "Practice communication");
      await userEvent.click(dateButton);
      await userEvent.click(
        within(screen.getByRole("grid")).getByText("15", { selector: "button", exact: true }),
      );
      await userEvent.click(dateButton);
      expect(dateButton).toHaveTextContent("15");
      expect(execute).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      const selectedDueDate = initialDueDate.replace("-10T", "-15T");
      const saved = mode === "create" ? execute.mock.calls[0][0].value : execute.mock.calls[0][0];
      expect(saved.dueDate).toBe(selectedDueDate);
      await userEvent.click(within(dialog).getByRole("button", { name: "Clear date" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      const cleared = mode === "create" ? execute.mock.calls[1][0].value : execute.mock.calls[1][0];
      expect(cleared.dueDate).toBeNull();
    },
  );
  it("hides cancelled plans and asks the parent for another bounded page", async () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const onPageChange = vi.fn();
    renderWith().render(
      <CompetenciesPlans
        workspace={workspace}
        subjectId=""
        userId="manager"
        canPlan
        canEnroll={false}
        pagination={{
          page: 1,
          total: 21,
          loading: false,
          onPageChange,
          actions: [
            workspace.actions[0],
            {
              ...workspace.actions[0],
              id: "cancelled",
              status: "cancelled",
              objective: "Abandoned action",
            },
          ],
        }}
      />,
    );
    expect(screen.queryByText("Abandoned action")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
  it("renders every server-authorized paginated action for inactive and deleted subjects", () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    renderWith().render(
      <CompetenciesPlans
        workspace={{
          ...workspace,
          people: [{ id: "employee", name: "Inactive employee", archived: true, canPlan: false }],
        }}
        subjectId=""
        userId="admin"
        canPlan
        canEnroll={false}
        pagination={{
          page: 7,
          total: 75,
          loading: false,
          onPageChange: vi.fn(),
          actions: [
            workspace.actions[0],
            {
              ...workspace.actions[0],
              id: "deleted",
              subjectId: "deleted",
              objective: "Retained deleted employee action",
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Retained practice" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retained deleted employee action" })).toBeVisible();
    expect(screen.queryByText("No development actions yet.")).not.toBeInTheDocument();
  });
  it("shows current job actions with completion instructions, without cancelled or unrelated actions", async () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const action = {
      id: "practice",
      subjectId: "employee",
      competencyId: "communication",
      levelId: "first",
      objective: "Practice a clear explanation",
      kind: "practice",
      status: "planned",
      ownerId: "manager",
      dueDate: "2026-10-25T12:00:00Z",
    };
    const workspace = {
      people: [
        { id: "employee", name: "Team employee" },
        { id: "manager", name: "Team manager" },
      ],
      catalog: [
        {
          id: "communication",
          name: "Effective communication",
          archived: false,
          levels: [
            {
              id: "first",
              name: "Foundation",
              conditions: [
                {
                  id: "conversation",
                  kind: "observation",
                  description: "Explain the task and check understanding",
                },
              ],
            },
            { id: "second", name: "Independent", conditions: [] },
            { id: "third", name: "Expert", conditions: [] },
          ],
        },
      ],
      assessments: [
        {
          subjectId: "employee",
          requirements: [
            {
              requirement: { competencyId: "communication", levelId: "second" },
              standing: { levels: [] },
            },
          ],
        },
      ],
      actions: [
        action,
        {
          ...action,
          id: "completed",
          status: "completed",
          levelId: "second",
          objective: "Completed coaching",
        },
        { ...action, id: "cancelled", status: "cancelled", objective: "Cancelled practice" },
        { ...action, id: "outside", competencyId: "other", objective: "Previous job practice" },
        { ...action, id: "higher", levelId: "third", objective: "Beyond job requirements" },
        { ...action, id: "unknown", levelId: "unknown", objective: "Unknown target" },
        { ...action, id: "other-person", subjectId: "outside", objective: "Other person" },
      ],
      evidence: [],
      actionHistory: [],
      verifiers: {},
      standings: [],
    } as unknown as CompetenciesWorkspace;
    const { rerender, container } = renderWith({ withQuery: true }).render(
      <CompetenciesPlans
        workspace={workspace}
        subjectId="employee"
        userId="employee"
        canPlan={false}
        canEnroll={false}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("Completed coaching")).toBeVisible();
    const summary = screen.getByText(action.objective).closest("section")!;
    expect(container.querySelector("details, summary")).not.toBeInTheDocument();
    expect(summary).toHaveTextContent("Explain the task and check understanding");
    expect(summary).toHaveTextContent("25 Oct 2026");
    expect(summary).not.toHaveTextContent("Planned");
    expect(within(summary).queryByText("Practice", { exact: true })).not.toBeInTheDocument();
    for (const name of [
      "Cancelled practice",
      "Previous job practice",
      "Beyond job requirements",
      "Unknown target",
      "Other person",
    ])
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    await userEvent.click(summary);
    expect(
      within(summary.parentElement!).queryByRole("button", { name: "Submit evidence" }),
    ).not.toBeInTheDocument();
    rerender(
      <CompetenciesPlans
        workspace={{ ...workspace, actions: [] }}
        subjectId="employee"
        userId="employee"
        canPlan={false}
        canEnroll={false}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Explain the task and check understanding" }),
    ).toBeVisible();
    expect(screen.getByText("Awaiting confirmation by the responsible person.")).toBeVisible();
    expect(screen.queryByText("No development actions yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit evidence" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Awaiting confirmation by the responsible person."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const pendingWorkspace = {
      ...workspace,
      actions: [],
      evidence: [
        {
          subjectId: "employee",
          competencyId: "communication",
          conditionIds: ["conversation"],
          status: "pending",
        },
      ],
    } as unknown as CompetenciesWorkspace;
    pendingWorkspace.assessments[0].requirements[0].standing.levels = [
      {
        levelId: "first",
        met: false,
        conditions: [
          {
            conditionId: "conversation",
            met: false,
            reason: "pending",
            evidenceIds: ["pending"],
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
      },
    ];
    rerender(
      <CompetenciesPlans
        workspace={pendingWorkspace}
        subjectId="employee"
        userId="employee"
        canPlan={false}
        canEnroll={false}
      />,
    );
    expect(screen.getByText("Awaiting confirmation by the responsible person.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Submit evidence" })).not.toBeInTheDocument();
    rerender(
      <CompetenciesPlans
        workspace={{ ...workspace, assessments: [] }}
        subjectId="employee"
        userId="employee"
        canPlan={false}
        canEnroll={false}
      />,
    );
    expect(screen.getByText("No development actions yet.")).toBeVisible();
  });

  it("shows direct course and document actions without expandable employee rows", async () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const onDocuments = vi.fn();
    const employeeWorkspace = {
      ...workspace,
      catalog: [
        {
          id: "competency",
          name: "Communication",
          archived: false,
          levels: [
            {
              id: "foundation",
              name: "Foundation",
              conditions: [
                {
                  id: "course",
                  kind: "course",
                  resourceId: "course",
                  description: "Complete the course",
                },
                { id: "document", kind: "document", description: "Provide a work sample" },
                { id: "observation", kind: "observation", description: "Demonstrate the skill" },
              ],
            },
          ],
        },
      ],
      assessments: [
        {
          subjectId: "employee",
          requirements: [
            {
              requirement: { competencyId: "competency", levelId: "foundation" },
              standing: { levels: [] },
            },
          ],
        },
      ],
      actions: [{ ...action, kind: "course", courseId: "course" }],
    } as unknown as CompetenciesWorkspace;
    const renderPlan = (value: CompetenciesWorkspace) => (
      <MemoryRouter>
        <CompetenciesPlans
          workspace={value}
          subjectId="employee"
          userId="employee"
          canPlan={false}
          canEnroll={false}
          onDocuments={onDocuments}
        />
      </MemoryRouter>
    );
    const { container, rerender } = renderWith().render(renderPlan(employeeWorkspace));
    expect(container.querySelector("details, summary")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/course/course",
    );
    await userEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(onDocuments).toHaveBeenCalledWith("employee");
    rerender(
      renderPlan({
        ...employeeWorkspace,
        actions: [{ ...employeeWorkspace.actions[0], kind: "practice", courseId: undefined }],
      }),
    );
    expect(screen.getByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/course/course",
    );
    rerender(renderPlan({ ...employeeWorkspace, actions: [] }));
    expect(screen.getByRole("link", { name: "Open course" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Documents" })).toBeVisible();
    const pending = structuredClone(employeeWorkspace);
    pending.assessments[0].requirements[0].standing.levels = [
      {
        levelId: "foundation",
        met: false,
        conditions: [
          {
            conditionId: "document",
            met: false,
            reason: "pending",
            evidenceIds: [],
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
      },
    ];
    rerender(renderPlan(pending));
    expect(screen.queryByRole("button", { name: "Documents" })).not.toBeInTheDocument();
    rerender(renderPlan({ ...pending, actions: [] }));
    expect(screen.queryByRole("button", { name: "Documents" })).not.toBeInTheDocument();
    expect(container.querySelector("details, summary")).not.toBeInTheDocument();
  });

  it("shows the whole managed team and requires a person for a new action", async () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const action = {
      id: "action",
      subjectId: "employee",
      competencyId: "competency",
      objective: "Practice a clear explanation",
      kind: "practice",
      status: "planned",
      ownerId: "manager",
      dueDate: null,
    };
    const workspace = {
      people: [
        { id: "employee", name: "Team employee", canPlan: true },
        { id: "outside", name: "Other employee", canPlan: false },
      ],
      actions: [
        action,
        { ...action, id: "outside-action", subjectId: "outside", objective: "Outside scope" },
      ],
      catalog: [],
      standings: [],
      evidence: [],
      actionHistory: [],
      verifiers: {},
    } as unknown as CompetenciesWorkspace;
    renderWith().render(
      <CompetenciesPlans
        workspace={workspace}
        subjectId=""
        userId="manager"
        canPlan
        canEnroll={false}
      />,
    );
    const table = screen.getByRole("table", { name: "Development Plans" });
    expect(within(table).getByText("Team employee")).toBeVisible();
    expect(screen.queryByText("Outside scope")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: action.objective }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: "Add development action" }),
    ).not.toBeInTheDocument();
    renderWith().render(
      <CompetenciesActionEditor
        workspace={workspace}
        subjectId=""
        userId="manager"
        close={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("combobox", { name: "Person" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
