import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/automations.keys";

import { useApplyAutomation } from "./useApplyAutomation";
import { useSimulateAutomation } from "./useSimulateAutomation";
import { useUpdateAutomation } from "./useUpdateAutomation";

import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  update: vi.fn(),
  simulate: vi.fn(),
  toast: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      automationManagementControllerApplyAutomation: mocks.apply,
      automationManagementControllerUpdateAutomation: mocks.update,
      automationManagementControllerSimulateAutomation: mocks.simulate,
    },
  },
}));
vi.mock("~/api/queryClient", () => ({ queryClient: { invalidateQueries: mocks.invalidate } }));
vi.mock("~/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => "en",
}));

function renderMutation<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const response = {
  data: { data: { workflow: { rootStepId: null, steps: [] }, appliedDefinition: null } },
};

describe("Automation success toasts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.apply.mockResolvedValue(response);
    mocks.update.mockResolvedValue(response);
  });

  it("shows only the apply success toast after applying", async () => {
    const { result } = renderMutation(useApplyAutomation);
    await act(async () => {
      await result.current.mutateAsync({ id: "automation-id" });
    });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: AUTOMATIONS_QUERY_KEY });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({ description: "automations.success.applied" });
  });

  it("shows the draft-saved toast after an explicit update", async () => {
    const { result } = renderMutation(useUpdateAutomation);
    await act(async () => {
      await result.current.mutateAsync({ id: "automation-id", data: { name: "Edited" } });
    });
    expect(mocks.toast).toHaveBeenCalledWith({ description: "automations.success.draftSaved" });
  });

  it("confirms a completed simulation without refreshing the automation list", async () => {
    mocks.simulate.mockResolvedValue({
      data: { data: { issues: [{ code: "missing_trigger" }], previews: [], steps: [] } },
    });
    const { result } = renderMutation(useSimulateAutomation);
    await act(async () => {
      await result.current.mutateAsync({ workflow: { rootStepId: null, steps: [] } });
    });
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "automations.success.simulationCompleted",
    });
  });

  it("shows only an error toast when the mutation fails", async () => {
    mocks.update.mockRejectedValue(new Error("request failed"));
    const { result } = renderMutation(useUpdateAutomation);
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: "automation-id", data: { name: "Edited" } }),
      ).rejects.toThrow("request failed");
    });
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
