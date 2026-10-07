import { readFileSync, readdirSync } from "node:fs";

import { PERMISSIONS } from "@repo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MultipleSelector from "~/components/ui/multiselect";

import CreatePhishingPage from "./CreatePhishing.page";
import PhishingPage from "./Phishing.page";
import { PhishingGate } from "./PhishingGate";
import { PhishingReport } from "./PhishingReport";

const fixtures = vi.hoisted(() => ({
  create: vi.fn(),
  cancel: vi.fn(),
  refetch: vi.fn(),
  gate: { data: { enabled: true }, isPending: false, isError: false },
  campaign: {
    id: "campaign-1",
    name: "Example campaign",
    status: "scheduled",
    sendWindow: { start: "2030-01-01T10:00:00Z", end: "2030-01-01T11:00:00Z" },
  },
  totals: { recipients: 2, sent: 1, clicked: 1, submitted: 0, risky: 1, riskRate: 50 },
  scenarios: [{ id: "scenario-1", name: "Invoice", description: "Sample scenario" }],
  options: {
    users: [{ id: "user-1", label: "Ada Example" }],
    groups: [{ id: "group-1", label: "Security", userIds: ["user-1"] }],
    courses: [{ id: "course-1", label: "Awareness" }],
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("~/api/queries/usePhishingConfiguration", () => ({
  usePhishingConfiguration: () => ({ ...fixtures.gate, refetch: fixtures.refetch }),
}));
vi.mock("~/api/queries/usePhishingOptions", () => ({
  usePhishingOptions: () => ({ data: fixtures.options }),
}));
vi.mock("~/api/queries/usePhishingScenarios", () => ({
  usePhishingScenarios: () => ({
    data: fixtures.scenarios,
  }),
}));
vi.mock("~/api/mutations/useCreatePhishingCampaign", () => ({
  useCreatePhishingCampaign: () => ({ mutateAsync: fixtures.create, isPending: false }),
}));

vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({
    data: {
      permissions: [
        PERMISSIONS.PHISHING_MANAGE,
        PERMISSIONS.COURSE_ENROLLMENT,
        PERMISSIONS.PHISHING_REPORT_READ,
      ],
    },
  }),
}));
vi.mock("~/api/queries/usePhishingCampaigns", () => ({
  usePhishingCampaigns: () => ({ data: [fixtures.campaign], refetch: fixtures.refetch }),
}));
vi.mock("~/api/queries/usePhishingReport", () => ({
  usePhishingReport: () => ({
    data: {
      campaign: fixtures.campaign,
      totals: fixtures.totals,
      groups: [],
      recipients: [
        {
          userId: "user-1",
          firstName: "Ada",
          lastName: "Example",
          email: "ada@example.test",
          sentAt: null,
          clickedAt: null,
          submittedAt: null,
          courseStatus: "notStarted",
        },
      ],
    },
    refetch: fixtures.refetch,
  }),
}));
vi.mock("~/api/mutations/useCancelPhishingCampaign", () => ({
  useCancelPhishingCampaign: () => ({ mutateAsync: fixtures.cancel, isPending: false }),
}));

function showCreate() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CreatePhishingPage />
    </MemoryRouter>,
  );
}

describe("Phishing design system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.gate.isPending = false;
    fixtures.gate.isError = false;
    fixtures.gate.data.enabled = true;
    Element.prototype.scrollTo = vi.fn();
  });
  it.each(readdirSync("app/locales"))("localizes the audience removal action in %s", (locale) => {
    const { phishing } = JSON.parse(readFileSync(`app/locales/${locale}/translation.json`, "utf8"));
    expect(phishing.removeSelection).toContain("{{label}}");
    expect(phishing.noOptions).toBeTruthy();
    expect(phishing.selectionHelp).not.toMatch(/Ctrl|Command|Strg/);
  });
  it.each([
    ["creation", readFileSync("app/modules/Phishing/CreatePhishing.page.tsx", "utf8")],
    ["list", readFileSync("app/modules/Phishing/Phishing.page.tsx", "utf8")],
    ["report and hall", readFileSync("app/modules/Phishing/PhishingReport.tsx", "utf8")],
  ])("keeps %s on shared states and design-system surfaces", (_name, source) => {
    expect(source).not.toMatch(/<(select|input|table|thead|tbody|tr|td|th)\b/);
    expect(source).not.toMatch(/<p role="(status|alert)"/);
    expect(source).toContain("PhishingLoading");
    expect(source).toContain("PhishingError");
    expect(source).toContain("<Card");
  });
  it("presents capability loading with a design-system skeleton", () => {
    fixtures.gate.isPending = true;
    render(
      <PhishingGate>
        <span>Privileged</span>
      </PhishingGate>,
    );
    expect(screen.getByRole("status").querySelector(".animate-pulse")).not.toBeNull();
  });
  it("presents capability errors in a destructive alert with retry", async () => {
    fixtures.gate.isError = true;
    render(
      <PhishingGate>
        <span>Privileged</span>
      </PhishingGate>,
    );
    expect(screen.getByRole("alert")).toHaveClass("border-destructive/50");
    await userEvent.click(screen.getByRole("button", { name: "phishing.retry" }));
    expect(fixtures.refetch).toHaveBeenCalledOnce();
  });
  it("presents unavailable capability in an empty-state card", () => {
    fixtures.gate.data.enabled = false;
    render(
      <PhishingGate>
        <span>Privileged</span>
      </PhishingGate>,
    );
    expect(screen.getByText("phishing.unavailable").closest(".bg-card")).not.toBeNull();
  });
  it("requires an accessible modal confirmation before cancellation", async () => {
    render(
      <MemoryRouter
        initialEntries={["/phishing/campaign-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/phishing/:id" element={<PhishingReport />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "phishing.cancel" }));
    const dialog = screen.getByRole("alertdialog", { name: "phishing.cancel" });
    expect(dialog).toHaveAccessibleDescription("phishing.cancelConfirm");
    expect(fixtures.cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "phishing.back" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "phishing.cancel" }));
    await userEvent.click(screen.getAllByRole("button", { name: "phishing.cancel" }).at(-1)!);
    expect(fixtures.cancel).toHaveBeenCalledWith("campaign-1");
  });
  it("uses the design-system report table with an accessible name", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PhishingReport />
      </MemoryRouter>,
    );
    expect(screen.getByRole("table", { name: "phishing.people" })).toHaveClass("caption-bottom");
    expect(screen.getByText("phishing.metrics.recipients").closest(".bg-card")).not.toBeNull();
  });
  it("uses design-system cards and badges in the campaign list", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PhishingPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Example campaign").closest(".bg-card")).not.toBeNull();
    expect(screen.getByText("phishing.status.scheduled")).toHaveClass("rounded-lg");
  });
  it("removes selected recipients without submitting the form and names the removal", async () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <MultipleSelector
          value={[{ value: "user-1", label: "Ada Example" }]}
          getRemoveLabel={() => "phishing.removeSelection"}
          hideClearAllButton
        />
      </form>,
    );
    const remove = screen.getByRole("button", { name: "phishing.removeSelection" });
    expect(remove).toHaveAttribute("type", "button");
    await userEvent.click(remove);
    expect(submit).not.toHaveBeenCalled();
    expect(fixtures.create).not.toHaveBeenCalled();
  });
  it("closes audience options with Escape even when the pointer is over the list", async () => {
    render(
      <MultipleSelector
        options={[{ value: "user-1", label: "Ada Example" }]}
        commandProps={{ label: "People" }}
        checkbox={false}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "People" }));
    fireEvent.mouseEnter(screen.getByRole("listbox"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option", { name: "Ada Example" })).not.toBeInTheDocument();
  });
  it("can enable scheduling without remounting or crashing the form", async () => {
    showCreate();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText("phishing.start")).toBeVisible();
  });
  it("offers accessible custom scenario, course and searchable audience controls", () => {
    showCreate();
    expect(screen.getByRole("combobox", { name: "phishing.scenario" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "phishing.course" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "phishing.people" }).tagName).toBe("INPUT");
    expect(screen.getByRole("combobox", { name: "phishing.groups" }).tagName).toBe("INPUT");
    expect(screen.getByRole("checkbox", { name: "phishing.schedule" }).tagName).toBe("BUTTON");
  });
});
