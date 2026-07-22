import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useScormRuntime } from "./useScormRuntime";

import type { ScormLaunchData } from "./ScormLesson.types";
import type { PropsWithChildren } from "react";

const mocks = vi.hoisted(() => ({
  commitRuntime: vi.fn(),
  finishRuntime: vi.fn(),
  handlers: new Map<string, () => void>(),
  t: (key: string) => key,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("~/api/mutations", () => ({
  useCommitScormRuntime: () => ({ mutateAsync: mocks.commitRuntime }),
  useFinishScormRuntime: () => ({ mutateAsync: mocks.finishRuntime }),
}));

vi.mock("./scormRuntime.helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("./scormRuntime.helpers")>();

  return {
    ...original,
    createScorm12Api: () => ({
      loadFromFlattenedJSON: vi.fn(),
      on: (event: string, handler: () => void) => mocks.handlers.set(event, handler),
      renderCommitCMI: () => ({ "cmi.core.lesson_status": "completed" }),
    }),
    exposeScormApi: vi.fn(),
    removeScormApi: vi.fn(),
  };
});

const launch = {
  attemptId: "attempt-1",
  packageId: "package-1",
  scoId: "sco-1",
  lessonId: "lesson-1",
  courseId: "course-1",
  runtime: { "cmi.core.lesson_status": "incomplete" },
} as ScormLaunchData;

describe("useScormRuntime", () => {
  it("does not restart and finish the runtime again after a cache-only runtime update", async () => {
    mocks.finishRuntime.mockResolvedValue({ messageKey: null });
    const onSavingChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(
      ({ currentLaunch }) =>
        useScormRuntime({ launch: currentLaunch, language: "en", onSavingChange }),
      {
        initialProps: { currentLaunch: launch },
        wrapper,
      },
    );

    act(() => mocks.handlers.get("LMSFinish")?.());

    await waitFor(() => expect(mocks.finishRuntime).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false));

    rerender({
      currentLaunch: {
        ...launch,
        runtime: { "cmi.core.lesson_status": "completed" },
      },
    });

    expect(mocks.finishRuntime).toHaveBeenCalledTimes(1);
  });
});
