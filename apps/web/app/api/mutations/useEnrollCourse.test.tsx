import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import cs from "~/locales/cs/translation.json";
import de from "~/locales/de/translation.json";
import en from "~/locales/en/translation.json";
import es from "~/locales/es/translation.json";
import fr from "~/locales/fr/translation.json";
import lt from "~/locales/lt/translation.json";
import pl from "~/locales/pl/translation.json";

import { useEnrollCourse } from "./useEnrollCourse";

import type { PropsWithChildren } from "react";

const archivedEnrollmentKey = "adminCourseView.errors.forbidden.archivedCourseEnrollment";
const mocks = vi.hoisted(() => ({
  enrollCourse: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { courseControllerEnrollCourse: mocks.enrollCourse } },
}));

vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "adminCourseView.errors.forbidden.archivedCourseEnrollment"
        ? en.adminCourseView.errors.forbidden.archivedCourseEnrollment
        : key,
  }),
}));

describe("useEnrollCourse", () => {
  it("shows the translated API error when an archived course rejects enrollment", async () => {
    vi.clearAllMocks();
    const error = Object.assign(new AxiosError("Forbidden"), {
      response: { data: { message: archivedEnrollmentKey } },
    });
    mocks.enrollCourse.mockRejectedValue(error);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useEnrollCourse(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: "course-id" })).rejects.toBe(error);
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      variant: "destructive",
      description: en.adminCourseView.errors.forbidden.archivedCourseEnrollment,
    });
  });

  it("has an archived enrollment message in every locale", () => {
    const translations = {
      [SUPPORTED_LANGUAGES.CS]: cs,
      [SUPPORTED_LANGUAGES.DE]: de,
      [SUPPORTED_LANGUAGES.EN]: en,
      [SUPPORTED_LANGUAGES.ES]: es,
      [SUPPORTED_LANGUAGES.FR]: fr,
      [SUPPORTED_LANGUAGES.LT]: lt,
      [SUPPORTED_LANGUAGES.PL]: pl,
    };

    for (const language of Object.values(SUPPORTED_LANGUAGES)) {
      const translation = translations[language];
      expect(translation.adminCourseView.errors.forbidden.archivedCourseEnrollment).toBeTruthy();
    }
  });
});
