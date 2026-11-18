import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";
import { setPageTitle } from "~/utils/setPageTitle";

import Layout from "./layout";

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { settingsControllerGetCompanyInformation: vi.fn() } },
}));

const languageStore = vi.hoisted(() => {
  let language = "en";
  const listeners = new Set<() => void>();

  return {
    get: () => language,
    set: (next: string) => {
      language = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
});

vi.mock("react-i18next", async () => {
  const { useSyncExternalStore } = await import("react");

  return {
    useTranslation: () => ({
      i18n: { language: useSyncExternalStore(languageStore.subscribe, languageStore.get) },
    }),
  };
});

const renderLayout = () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <Suspense fallback={<div>Loading company</div>}>
            <Layout />
          </Suspense>
        ),
        children: [{ path: "dashboard", element: <div>Dashboard page</div> }],
      },
    ],
    { initialEntries: ["/dashboard"] },
  );
  const revalidate = vi.spyOn(router, "revalidate");

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return revalidate;
};

describe("company metadata without route loaders", () => {
  beforeEach(() => {
    queryClient.clear();
    languageStore.set("en");
  });
  afterEach(() => queryClient.clear());

  it("waits for company information and re-renders route metadata when the platform name changes", async () => {
    type CompanyResponse = Awaited<
      ReturnType<typeof ApiClient.api.settingsControllerGetCompanyInformation>
    >;
    let resolveCompany!: (value: CompanyResponse) => void;

    vi.mocked(ApiClient.api.settingsControllerGetCompanyInformation).mockReturnValue(
      new Promise<CompanyResponse>((resolve) => {
        resolveCompany = resolve;
      }) as ReturnType<typeof ApiClient.api.settingsControllerGetCompanyInformation>,
    );
    const revalidate = renderLayout();

    expect(screen.getByText("Loading company")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    resolveCompany({ data: { data: { companyShortName: "Acme" } } } as CompanyResponse);
    await screen.findByText("Dashboard page");
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
    revalidate.mockClear();
    act(() => {
      queryClient.setQueryData(companyInformationQueryOptions.queryKey, {
        data: { companyShortName: "Renamed" },
      });
    });
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
  });

  it("re-renders route metadata when the user's language changes", async () => {
    queryClient.setQueryData(companyInformationQueryOptions.queryKey, {
      data: { companyShortName: "Acme" },
    });
    const revalidate = renderLayout();

    await screen.findByText("Dashboard page");
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
    revalidate.mockClear();
    act(() => languageStore.set("pl"));
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
  });

  it("reads company branding from the query cache for route metadata", () => {
    queryClient.setQueryData(companyInformationQueryOptions.queryKey, {
      data: { companyShortName: "Acme" },
    });
    const result = setPageTitle([], "pages.dashboard");

    expect(result[0].title).toMatch(/Acme$/);
  });
});
