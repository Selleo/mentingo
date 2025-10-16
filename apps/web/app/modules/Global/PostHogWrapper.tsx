import { PostHogProvider } from "posthog-js/react";

import type { PostHogConfig } from "posthog-js";
import type React from "react";

interface PostHogWrapperProps {
  children: React.ReactNode;
}

export function PostHogWrapper({ children }: PostHogWrapperProps) {
  const posthogOptions: Partial<PostHogConfig> = {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageleave: true,
    capture_pageview: true,
  };

  return (
    <PostHogProvider apiKey={import.meta.env.VITE_POSTHOG_KEY} options={posthogOptions}>
      {children}
    </PostHogProvider>
  );
}
