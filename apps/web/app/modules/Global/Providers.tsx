import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PostHogProvider } from "posthog-js/react";
import { I18nextProvider } from "react-i18next";

import i18n from "../../../i18n";
import { queryClient } from "../../api/queryClient";
import { LanguageProvider } from "../Dashboard/Settings/Language/LanguageProvider";
import { ThemeProvider } from "../Theme";

import type { PostHogConfig } from "posthog-js";

const posthogOptions: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
  capture_pageleave: true,
  capture_pageview: true,
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider apiKey={import.meta.env.VITE_POSTHOG_KEY} options={posthogOptions}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <LanguageProvider>{children}</LanguageProvider>
            {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </PostHogProvider>
  );
}
