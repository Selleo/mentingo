import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "@remix-run/react";
import { Suspense } from "react";

import { version } from "~/../version.json";

import { PlatformFavicon } from "./components/PlatformFavicon";
import { Toaster } from "./components/ui/toaster";
import { useNavigationTracker } from "./hooks/useNavigationTracker";
import css from "./index.css?url";
import CustomErrorBoundary from "./modules/common/ErrorBoundary/ErrorBoundary";
import Loader from "./modules/common/Loader/Loader";
import { Providers } from "./modules/Global/Providers";
import { ThemeWrapper } from "./modules/Global/ThemeWrapper";

import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => {
  return [
    { rel: "icon", href: "/app-signet.svg", type: "image/svg+xml" },
    { rel: "shortcut icon", href: "/app-signet.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/app-signet.svg" },
    { rel: "manifest", href: "/api/settings/manifest.webmanifest" },
    { rel: "stylesheet", href: css },
  ];
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="generator" content={`Mentingo LMS ${version}`} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <Toaster />
      </body>
    </html>
  );
}

export default function Root() {
  useNavigationTracker();

  return (
    <Providers>
      <ThemeWrapper>
        <PlatformFavicon />
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </ThemeWrapper>
    </Providers>
  );
}

export function HydrateFallback() {
  return <div />;
}
export function ErrorBoundary() {
  const error = useRouteError();

  return <CustomErrorBoundary error={error} />;
}
