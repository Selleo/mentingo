import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { get } from "lodash-es";

import { PlatformFavicon } from "./components/PlatformFavicon";
import { Toaster } from "./components/ui/toaster";
import { useNavigationTracker } from "./hooks/useNavigationTracker";
import css from "./index.css?url";
import CustomErrorBoundary from "./modules/common/ErrorBoundary/ErrorBoundary";
import { Providers } from "./modules/Global/Providers";
import { ThemeWrapper } from "./modules/Global/ThemeWrapper";

import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => {
  return [
    { rel: "icon", href: "/app-signet.svg", type: "image/svg+xml" },
    { rel: "shortcut icon", href: "/app-signet.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/app-signet.svg" },
    { rel: "stylesheet", href: css },
  ];
};

export function loader() {
  const importEnvApiUrl = get(import.meta.env, "VITE_API_URL") || null;
  const processEnvApiUrl = get(process.env, "VITE_API_URL") || null;
  const importEnvAppUrl = get(import.meta.env, "VITE_APP_URL") || null;
  const processEnvAppUrl = get(process.env, "VITE_APP_URL") || null;

  return {
    ENV: {
      VITE_API_URL: importEnvApiUrl || processEnvApiUrl || "",
      VITE_APP_URL: importEnvAppUrl || processEnvAppUrl || "",
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { ENV } = useLoaderData<typeof loader>();
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: `window.ENV = ${JSON.stringify(ENV)};` }}
        />
      </head>
      <body>
        {children}
        <script
          type="text/javascript"
          src={
            import.meta.env.VITE_PLAYERJS_CDN_URL ||
            "//assets.mediadelivery.net/playerjs/playerjs-latest.min.js"
          }
          defer
        />
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
        <Outlet />
      </ThemeWrapper>
    </Providers>
  );
}

export function HydrateFallback() {
  return <div />;
}
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <CustomErrorBoundary stack={error.data} message={error.statusText} />;
  } else if (error instanceof Error) {
    return <CustomErrorBoundary stack={error.stack} message={error.message} />;
  } else {
    return <CustomErrorBoundary />;
  }
}
