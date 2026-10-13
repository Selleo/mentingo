import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";
import { setPageTitle } from "~/utils/setPageTitle";

import Layout from "./layout";

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { settingsControllerGetCompanyInformation: vi.fn() } },
}));

describe("company metadata without route loaders", () => {
  beforeEach(() => {
    queryClient.clear();
    document.title = "Dashboard";
  });
  afterEach(() => queryClient.clear());

  it("waits for company information and brands the initial page title", async () => {
    type CompanyResponse = Awaited<
      ReturnType<typeof ApiClient.api.settingsControllerGetCompanyInformation>
    >;
    let resolveCompany!: (value: CompanyResponse) => void;
    vi.mocked(ApiClient.api.settingsControllerGetCompanyInformation).mockReturnValue(
      new Promise<CompanyResponse>((resolve) => {
        resolveCompany = resolve;
      }) as ReturnType<typeof ApiClient.api.settingsControllerGetCompanyInformation>,
    );
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Suspense fallback={<div>Loading company</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="dashboard" element={<div>Dashboard page</div>} />
              </Route>
            </Routes>
          </Suspense>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Loading company")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    resolveCompany({ data: { data: { companyShortName: "Acme" } } } as CompanyResponse);
    await screen.findByText("Dashboard page");
    await waitFor(() => expect(document.title).toBe("Acme - Dashboard"));
    act(() => {
      queryClient.setQueryData(companyInformationQueryOptions.queryKey, {
        data: { companyShortName: "Renamed" },
      });
    });
    await waitFor(() => expect(document.title).toBe("Renamed - Dashboard"));
  });

  it("reads company branding from the query cache for route metadata", () => {
    queryClient.setQueryData(companyInformationQueryOptions.queryKey, {
      data: { companyShortName: "Acme" },
    });
    const result = setPageTitle([], "pages.dashboard");
    expect(result[0].title).toMatch(/^Acme - /);
  });
});
