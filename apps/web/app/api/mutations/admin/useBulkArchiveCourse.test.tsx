import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBulkArchiveCourse } from "./useBulkArchiveCourse";

import type { PropsWithChildren } from "react";

const mocks = vi.hoisted(() => ({
  archiveCourse: vi.fn(),
  invalidateCourseListData: vi.fn(),
  invalidateQueries: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { courseControllerBulkArchiveCourse: mocks.archiveCourse } },
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

vi.mock("~/api/utils/invalidateCourseListData", () => ({
  invalidateCourseListData: mocks.invalidateCourseListData,
}));

vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("useBulkArchiveCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archiveCourse.mockResolvedValue({ data: { message: "ok" } });
    mocks.invalidateCourseListData.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("invalidates course lists and dependent views, then shows success feedback", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBulkArchiveCourse(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ids: ["course-id"], isArchived: true });
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["globalSettings"] }),
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["course"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: [["beta-course", "admin"]] });
    expect(mocks.invalidateCourseListData).toHaveBeenCalledOnce();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["global-search"] });
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "adminCoursesView.toast.bulkArchiveUpdateSuccessfully",
    });
  });

  it("shows the API error in a destructive toast when the archive request fails", async () => {
    const error = new Error("request failed");
    mocks.archiveCourse.mockRejectedValue(error);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBulkArchiveCourse(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ ids: ["course-id"], isArchived: false }),
      ).rejects.toBe(error);
    });

    expect(mocks.invalidateCourseListData).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "request failed",
      variant: "destructive",
    });
  });
});
