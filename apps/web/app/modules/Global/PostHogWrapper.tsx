import { PostHogProvider } from "posthog-js/react";

import { usePostHogConfig } from "../../api/queries/usePostHogConfig";
import Loader from "../common/Loader/Loader";

import type { PostHogConfig } from "posthog-js";

interface PostHogWrapperProps {
  children: React.ReactNode;
}

export function PostHogWrapper({ children }: PostHogWrapperProps) {
  const { data: posthogConfig, isLoading: isPosthogLoading } = usePostHogConfig();

  if (isPosthogLoading) {
    return (
      <div className="grid h-screen w-screen place-items-center">
        <Loader />
      </div>
    );
  }

  const { host: posthogHost, key: posthogKey } = posthogConfig?.data || {};

  const posthogOptions: Partial<PostHogConfig> = {
    api_host: posthogHost || "https://eu.i.posthog.com",
    capture_pageleave: true,
    capture_pageview: true,
  };

  return (
    <PostHogProvider apiKey={posthogKey as string} options={posthogOptions}>
      {children}
    </PostHogProvider>
  );
}
