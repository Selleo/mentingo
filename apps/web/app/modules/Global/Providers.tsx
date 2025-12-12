import { TourProvider, useTour } from "@reactour/tour";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useCallback, useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import { useGlobalVideoUploadNotifications } from "~/hooks/useGlobalVideoUploadNotifications";

import i18n from "../../../i18n";
import { ApiClient } from "../../api/api-client";
import { currentUserQueryOptions } from "../../api/queries";
import { queryClient } from "../../api/queryClient";
import { LanguageProvider } from "../Dashboard/Settings/Language/LanguageProvider";
import { ThemeProvider } from "../Theme";

import { PostHogWrapper } from "./PostHogWrapper";

import type { OnboardingPages } from "@repo/shared";

function TourKeyboardHandler({
  handleCloseTour,
}: {
  handleCloseTour: ({
    meta,
    setIsOpen,
  }: {
    meta?: string | undefined;
    setIsOpen: (isOpen: boolean) => void;
  }) => void;
}) {
  const { isOpen, setIsOpen, meta } = useTour();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseTour({ meta, setIsOpen });
      }
    },
    [handleCloseTour, meta, setIsOpen],
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Global polling for video uploads
  useGlobalVideoUploadNotifications();

  const handleCloseTour = useCallback(
    ({ meta, setIsOpen }: { meta?: string | undefined; setIsOpen: (isOpen: boolean) => void }) => {
      setIsOpen(false);
      if (!meta) return;
      void ApiClient.api
        .userControllerMarkOnboardingComplete(meta as OnboardingPages)
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: currentUserQueryOptions.queryKey,
          });
        })
        .catch(() => {});
    },
    [],
  );

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <PostHogWrapper>
          <TourProvider
            steps={[]}
            onClickMask={handleCloseTour}
            onClickClose={handleCloseTour}
            styles={{
              popover: (base) => ({
                ...base,
                borderRadius: "8px",
              }),
              maskArea: (base) => ({
                ...base,
                rx: 16,
              }),
              maskWrapper: (base) => ({
                ...base,
                backgroundColor: "var(--color-black)",
                opacity: 0.4,
              }),
              badge: (base) => ({
                ...base,
                backgroundColor: "var(--primary-700)",
              }),
              close: (base) => ({
                ...base,
                color: "var(--primary-700)",
                top: "16px",
                right: "16px",
              }),
            }}
            position="top"
            disableDotsNavigation
            badgeContent={({ totalSteps, currentStep }) => `${currentStep + 1} / ${totalSteps}`}
            showDots={false}
          >
            <TourKeyboardHandler handleCloseTour={handleCloseTour} />
            <ThemeProvider>
              <LanguageProvider>{children}</LanguageProvider>
              {process.env.NODE_ENV === "development" && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </ThemeProvider>
          </TourProvider>
        </PostHogWrapper>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
