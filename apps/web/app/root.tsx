import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";

import faviconHref from "~/assets/favicon.ico";
import { Toaster } from "~/components/ui/toaster";

import "./index.css";
import CustomErrorBoundary from "./modules/common/ErrorBoundary/ErrorBoundary";
import { Providers } from "./modules/Global/Providers";

import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => {
  return [{ rel: "icon", href: faviconHref, type: "image/x-icon" }];
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  return (
    <Providers>
      <Outlet />
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
