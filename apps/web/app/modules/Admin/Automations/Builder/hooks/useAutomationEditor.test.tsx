import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAutomationEditor } from "./useAutomationEditor";

import type { AutomationDefinition, AutomationDto } from "@repo/shared";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  apply: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      automationManagementControllerCreateAutomation: api.create,
      automationManagementControllerUpdateAutomation: api.update,
      automationManagementControllerApplyAutomation: api.apply,
    },
  },
}));
vi.mock("@remix-run/react", () => ({ useNavigate: () => api.navigate }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => "en",
}));
vi.mock("~/api/mutations/automations/useAutomationMutationFeedback", () => ({
  useAutomationMutationFeedback: () => ({}),
}));

const definition: AutomationDefinition = {
  name: "Welcome",
  description: "Onboarding",
  workflow: {
    rootStepId: "00000000-0000-4000-8000-000000000001",
    steps: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: "trigger",
        parentId: null,
        position: 0,
        config: { eventKind: "welcome" },
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: "send_email",
        parentId: "00000000-0000-4000-8000-000000000001",
        position: 0,
        config: { template: { type: "builtin", key: "welcome" } },
      },
    ],
  },
};
const automation: AutomationDto = {
  ...definition,
  id: "00000000-0000-4000-8000-000000000003",
  status: "draft",
  executionVersion: 0,
  hasUnappliedChanges: true,
  appliedDefinition: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function renderEditor(record?: AutomationDto) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderHook(() => useAutomationEditor(record), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("Automation editor publishing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.create.mockResolvedValue({ data: { data: automation } });
    api.update.mockResolvedValue({ data: { data: automation } });
    api.apply.mockImplementation(async (_id, body) => ({
      data: { data: { ...automation, ...body.definition, appliedDefinition: body.definition } },
    }));
  });

  it("publishes unsaved edits without a separate draft-save request", async () => {
    const { result } = renderEditor(automation);
    const edited = { ...definition, name: "Updated welcome" };
    act(() => result.current.updateDefinition(edited));
    expect(result.current.hasUnsavedChanges).toBe(true);
    await act(async () => {
      await result.current.applySavedDraft();
    });
    expect(api.update).not.toHaveBeenCalled();
    expect(api.apply).toHaveBeenCalledTimes(1);
    expect(api.apply).toHaveBeenCalledWith(
      automation.id,
      { definition: edited },
      { language: "en" },
    );
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("applies an already saved draft without logging another draft save", async () => {
    const { result } = renderEditor(automation);
    await act(async () => {
      await result.current.applySavedDraft();
    });
    expect(api.apply).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("keeps the explicit Save draft action", async () => {
    const { result } = renderEditor(automation);
    await act(async () => {
      await result.current.saveDraft();
    });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.apply).not.toHaveBeenCalled();
  });

  it("keeps edits unsaved when applying fails", async () => {
    api.apply.mockRejectedValue(new Error("apply failed"));
    const { result } = renderEditor(automation);
    act(() => result.current.updateDefinition({ ...definition, name: "Edited" }));
    await act(async () => {
      await expect(result.current.applySavedDraft()).rejects.toThrow("apply failed");
    });
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("creates a new automation before applying without a draft-update request", async () => {
    const { result } = renderEditor();
    act(() => result.current.updateDefinition(definition));
    await act(async () => {
      await result.current.applySavedDraft();
    });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.apply).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
    expect(api.navigate).toHaveBeenCalledWith(`/admin/automations/${automation.id}`);
  });

  it("does not publish a blank name", async () => {
    const { result } = renderEditor(automation);
    act(() => result.current.updateDefinition({ ...definition, name: " " }));
    await act(async () => {
      await result.current.applySavedDraft();
    });
    expect(api.apply).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(result.current.issues).toEqual(["automations.nameRequired"]);
  });
});
