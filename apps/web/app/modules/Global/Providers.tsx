import { TourProvider } from "@reactour/tour";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { I18nextProvider } from "react-i18next";

import i18n from "../../../i18n";
import { queryClient } from "../../api/queryClient";
import { LanguageProvider } from "../Dashboard/Settings/Language/LanguageProvider";
import { ThemeProvider } from "../Theme";

import { PostHogWrapper } from "./PostHogWrapper";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <PostHogWrapper>
          <TourProvider
            steps={[]}
            styles={{
              popover: (base) => ({
                ...base,
                borderRadius: "8px",
              }),
              maskArea: (base) => ({
                ...base,
                rx: 16,
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
