import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateLearningPath } from "../useCreateLearningPath";
import { useUpdateLearningPath } from "../useUpdateLearningPath";

import type { PropsWithChildren } from "react";

const mocks = vi.hoisted(() => ({
  createLearningPath: vi.fn(),
  updateLearningPath: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      learningPathControllerCreateLearningPath: mocks.createLearningPath,
      learningPathControllerUpdateLearningPath: mocks.updateLearningPath,
    },
  },
}));

vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const TRANSLATED_KEYS = new Set([
  "files.toast.fileTooLarge",
  "learningPathView.toast.createError",
  "learningPathView.toast.updateError",
]);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      TRANSLATED_KEYS.has(key) ? key : (options?.defaultValue ?? key),
  }),
}));

const apiError = (data: Record<string, unknown>) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    data,
  } as AxiosResponse);

const renderMutation = <T,>(hook: () => T) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(hook, { wrapper }).result;
};

describe("learning path error toasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the translated API error when creating fails", async () => {
    mocks.createLearningPath.mockRejectedValue(apiError({ message: "files.toast.fileTooLarge" }));
    const result = renderMutation(() => useCreateLearningPath());

    await act(async () => {
      await result.current.mutateAsync({} as never).catch(() => undefined);
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      description: "files.toast.fileTooLarge",
      variant: "destructive",
    });
  });

  it("falls back to the update error when the API gives no message", async () => {
    mocks.updateLearningPath.mockRejectedValue(apiError({}));
    const result = renderMutation(() => useUpdateLearningPath());

    await act(async () => {
      await result.current
        .mutateAsync({ learningPathId: "path-id", data: {} as never })
        .catch(() => undefined);
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      description: "learningPathView.toast.updateError",
      variant: "destructive",
    });
  });
});
