import { createRemixStub } from "@remix-run/testing";
import { DEFAULT_REPORT_SORT, REPORT_SORT_DIRECTIONS, REPORT_SORT_FIELDS } from "@repo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import ReportsPage from "./Reports.page";

const scoreAscending = {
  sortBy: REPORT_SORT_FIELDS.SCORE,
  sortDirection: REPORT_SORT_DIRECTIONS.ASC,
};

const { report, createExport } = vi.hoisted(() => ({
  report: vi.fn(),
  createExport: vi.fn().mockResolvedValue({ id: "export" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAccess: true }) }));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("~/api/queries/useReportResult", () => ({
  useReportResult: (query: unknown) => {
    report(query);
    return { data: { rows: [], total: 50, page: 1, pageSize: 10, capturedAt: "2026-01-01" } };
  },
}));
vi.mock("~/api/queries/useReportOptions", () => ({ useReportOptions: () => ({}) }));
vi.mock("~/api/queries/useReportConfigurations", () => ({
  useReportConfigurations: () => ({ data: [] }),
}));
vi.mock("~/api/queries/useReportExportStatus", () => ({ useReportExportStatus: () => ({}) }));
vi.mock("~/api/mutations/useCreateReportExport", () => ({
  useCreateReportExport: () => ({ mutateAsync: createExport }),
}));
vi.mock("~/api/mutations/useCreateReportConfiguration", () => ({
  useCreateReportConfiguration: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/useUpdateReportConfiguration", () => ({
  useUpdateReportConfiguration: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/useDeleteReportConfiguration", () => ({
  useDeleteReportConfiguration: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/useDownloadReportExport", () => ({
  useDownloadReportExport: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/modules/Reports/components/ReportMetrics", () => ({
  ReportHeadlineMetrics: () => null,
  ReportOutcomeMetrics: () => null,
}));
vi.mock("~/modules/Reports/components/ReportBreakdownChart", () => ({
  ReportBreakdownChart: () => null,
}));
vi.mock("~/modules/Reports/components/ReportResultsTable", () => ({
  ReportResultsTable: ({
    onSortChange,
    onPageChange,
  }: {
    onSortChange: (sort: unknown) => void;
    onPageChange: (page: number) => void;
  }) => (
    <>
      <button onClick={() => onPageChange(3)}>third page</button>
      <button onClick={() => onSortChange(scoreAscending)}>sort score</button>
    </>
  ),
}));

it("requests latest activity initially, resets pagination on sort and exports the active server order", async () => {
  const Stub = createRemixStub([{ path: "/reports", Component: ReportsPage }]);
  render(<Stub initialEntries={["/reports"]} />);
  await waitFor(() =>
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...DEFAULT_REPORT_SORT, page: 1 }),
    ),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "third page" }));
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  await user.click(screen.getByRole("button", { name: "sort score" }));
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ ...scoreAscending, page: 1 }));
  await user.click(screen.getByRole("button", { name: "reports.exports.exportSpreadsheet" }));
  expect(createExport).toHaveBeenCalledWith(
    expect.objectContaining({
      query: expect.objectContaining({ ...scoreAscending, page: 1 }),
    }),
  );
});
