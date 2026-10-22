import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configuration: {
    data: undefined as { enabled: boolean; canManage: boolean; canPlan: boolean } | undefined,
    isPending: true,
    isError: false,
    refetch: vi.fn(),
  },
  workspace: {
    data: undefined as object | undefined,
    isPending: true,
    isError: false,
    refetch: vi.fn(),
  },
  currentUser: { id: "employee", permissions: [] as string[] },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("~/api/queries/useCompetenciesConfiguration", () => ({
  useCompetenciesConfiguration: () => mocks.configuration,
}));
vi.mock("~/api/queries/useCompetenciesWorkspace", () => ({
  useCompetenciesWorkspace: (query: { profileId?: string }) =>
    query.profileId === "deleted"
      ? { ...mocks.workspace, data: undefined, isPending: false, isError: true }
      : mocks.workspace,
}));
vi.mock("~/api/queries/useCompetencyRecords", () => ({
  useCompetencyRecords: () => ({
    data: { actions: [], evidence: [], total: 0 },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: mocks.currentUser }),
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: (selector: (state: { language: string }) => string) =>
    selector({ language: "en" }),
}));
vi.mock("./components/CompetencySubject", () => ({
  CompetencySubject: ({ subjectId }: { subjectId: string }) => <div>Subject: {subjectId}</div>,
}));
vi.mock("./components/CompetenciesReview", () => ({
  CompetenciesReview: ({ onSubject }: { onSubject: (id: string) => void }) => (
    <button onClick={() => onSubject("colleague")}>Open colleague</button>
  ),
}));
vi.mock("./components/CompetenciesPeople", () => ({ CompetenciesPeople: () => null }));

import CompetenciesPage, {
  buildCompetenciesWorkspaceQuery,
  hasCompetenciesVerifierAccess,
} from "./Competencies.page";

const admin = { canManage: true, canPlan: true };
const manager = { canManage: false, canPlan: true };

const query = (
  capabilities: typeof admin,
  tab: Parameters<typeof buildCompetenciesWorkspaceQuery>[0]["tab"],
) =>
  buildCompetenciesWorkspaceQuery({
    language: "en",
    capabilities,
    tab,
    subjectId: "employee",
    profileId: "",
    matrixProfileId: "",
  });

describe("buildCompetenciesWorkspaceQuery", () => {
  it("loads all tenant assignments for administrators in Employees", () => {
    expect(query(admin, "people")).toEqual({ language: "en", view: "summary" });
  });

  it("keeps Employees scoped to managed people for managers", () => {
    expect(query(manager, "people")).toEqual({ language: "en", teamOnly: "true", view: "summary" });
  });

  it("loads the cross-team Approval queue for a manager who verifies conditions", () => {
    expect(query(manager, "review")).toEqual({ language: "en", view: "review" });
  });

  it("keeps an explicitly selected employee detail query available to managers", () => {
    expect(query(manager, "own")).toEqual({ language: "en", subjectId: "employee" });
  });

  it("preserves team scoping for the admin matrix", () => {
    expect(query(admin, "matrix")).toEqual({ language: "en", teamOnly: "true", view: "summary" });
  });

  it("shows Approval access for an employee assigned to a condition", () => {
    expect(
      hasCompetenciesVerifierAccess({
        verifiers: { communication: ["employee-verifier"] },
        userId: "employee-verifier",
      }),
    ).toBe(true);
  });
});

describe("CompetenciesPage states", () => {
  it("keeps configuration loading inside the normal page context", () => {
    mocks.configuration = {
      ...mocks.configuration,
      data: undefined,
      isPending: true,
      isError: false,
    };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByText("competencies.title")).toBeVisible();
    expect(document.querySelector(".breadcrumbs")).toBeVisible();
  });

  it("renders the disabled capability as a titled empty state", () => {
    mocks.configuration = {
      ...mocks.configuration,
      data: { enabled: false, canManage: false, canPlan: false },
      isPending: false,
      isError: false,
    };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "competencies.title" })).toBeVisible();
    expect(screen.getByText("competencies.unavailable")).toHaveClass("border-dashed");
  });

  it("renders configuration errors as a shared error page", () => {
    mocks.configuration = { ...mocks.configuration, isPending: false, isError: true };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "competencies.serviceError" })).toBeVisible();
    screen.getByRole("button", { name: "competencies.retry" }).click();
    expect(mocks.configuration.refetch).toHaveBeenCalled();
  });

  it("keeps workspace loading inside its own normal page context", () => {
    mocks.configuration = {
      ...mocks.configuration,
      data: { enabled: true, canManage: false, canPlan: false },
      isPending: false,
      isError: false,
    };
    mocks.workspace = { ...mocks.workspace, data: undefined, isPending: true, isError: false };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeVisible();
    expect(document.querySelector(".breadcrumbs")).toBeVisible();
  });
});

describe("CompetenciesPage navigation", () => {
  const workspace = {
    catalog: [],
    profiles: [],
    publishedProfiles: [],
    subjects: [],
    people: [],
    standings: [],
    assessments: [],
    evidence: [],
    actions: [],
    awardHistory: [],
    revocations: [],
    conditionOverrides: [],
    verifiers: {},
    courses: [],
    learningResources: [],
    asOf: "2026-10-21T00:00:00Z",
  };

  it.each([
    {
      name: "admin",
      userId: "admin",
      capabilities: admin,
      verifiers: {},
      visible: [
        "catalog",
        "profiles",
        "people",
        "documents",
        "team",
        "matrix",
        "plans",
        "settings",
      ],
      hidden: ["own", "review", "rules"],
    },
    {
      name: "designated verifier",
      userId: "employee-verifier",
      capabilities: { canManage: false, canPlan: false },
      verifiers: { communication: ["employee-verifier"] },
      visible: ["own", "documents", "review", "plans"],
      hidden: [],
    },
    {
      name: "unassigned employee",
      userId: "employee",
      capabilities: { canManage: false, canPlan: false },
      verifiers: {},
      visible: ["own", "documents", "plans"],
      hidden: ["review"],
    },
  ])(
    "shows the right ordered tabs for $name",
    ({ userId, capabilities, verifiers, visible, hidden }) => {
      mocks.configuration = {
        ...mocks.configuration,
        data: { enabled: true, ...capabilities },
        isPending: false,
        isError: false,
      };
      mocks.currentUser = { id: userId, permissions: [] };
      mocks.workspace = {
        ...mocks.workspace,
        data: {
          ...workspace,
          people: [{ id: userId, name: userId, archived: false, canPlan: capabilities.canPlan }],
          verifiers,
        },
        isPending: false,
        isError: false,
      };
      render(
        <MemoryRouter>
          <CompetenciesPage />
        </MemoryRouter>,
      );

      const tabs = screen.getByRole("tablist").querySelectorAll('[role="tab"]');
      expect([...tabs].map((tab) => tab.getAttribute("data-testid"))).toEqual(
        visible.map((tab) => `competencies-${tab}-tab`),
      );
      for (const tab of hidden) expect(screen.queryByTestId(`competencies-${tab}-tab`)).toBeNull();
    },
  );

  it("opens another person's details from a fresh verifier review", async () => {
    mocks.configuration = {
      ...mocks.configuration,
      data: { enabled: true, canManage: false, canPlan: false },
      isPending: false,
      isError: false,
    };
    mocks.currentUser = { id: "verifier", permissions: [] };
    mocks.workspace = {
      ...mocks.workspace,
      data: {
        ...workspace,
        people: [
          { id: "verifier", name: "Verifier", archived: false, canPlan: false },
          { id: "colleague", name: "Colleague", archived: false, canPlan: false },
        ],
        verifiers: { observation: ["verifier"] },
      },
      isPending: false,
      isError: false,
    };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByTestId("competencies-review-tab"));
    await userEvent.click(screen.getByRole("button", { name: "Open colleague" }));
    expect(screen.getByText("Subject: colleague")).toBeVisible();
  });

  it("recovers when the selected comparison profile has been deleted", async () => {
    mocks.configuration = {
      ...mocks.configuration,
      data: { enabled: true, canManage: false, canPlan: true },
      isPending: false,
      isError: false,
    };
    mocks.currentUser = { id: "manager", permissions: [] };
    mocks.workspace = {
      ...mocks.workspace,
      data: {
        ...workspace,
        people: [{ id: "manager", name: "Manager", archived: false, canPlan: true }],
        publishedProfiles: [{ id: "deleted", name: "Deleted profile", requirements: [] }],
      },
      isPending: false,
      isError: false,
    };
    render(
      <MemoryRouter>
        <CompetenciesPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByTestId("competencies-team-tab"));
    await userEvent.click(screen.getByRole("combobox", { name: "competencies.compareProfile" }));
    await userEvent.click(screen.getByRole("option", { name: "Deleted profile" }));
    expect(screen.getByTestId("competencies-team-tab")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "competencies.serviceError" })).toBeNull();
  });
});
