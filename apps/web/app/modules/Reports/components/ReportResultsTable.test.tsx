import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportResultsTable } from "./ReportResultsTable";

import type { RunReportResponse } from "~/api/generated-api";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const result = {
  rows: [],
  total: 0,
  page: 3,
  pageSize: 25,
} as unknown as RunReportResponse["data"];

describe("report sorting headers", () => {
  it("offers every summary column as a keyboard-accessible server sorting control, with active direction", async () => {
    const onSortChange = vi.fn();
    render(
      <ReportResultsTable
        result={result}
        view="organisation"
        language="en"
        timezone="UTC"
        isFetching={false}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        sort={{ sortBy: "lastActivity", sortDirection: "desc" }}
        onSortChange={onSortChange}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(8);
    for (const header of headers) expect(within(header).getByRole("button")).toBeDefined();
    expect(headers[7].getAttribute("aria-sort")).toBe("descending");
    expect(headers[0].getAttribute("aria-sort")).toBe("none");
    const user = userEvent.setup();
    await user.click(within(headers[0]).getByRole("button"));
    expect(onSortChange).toHaveBeenLastCalledWith({ sortBy: "learner", sortDirection: "asc" });
    within(headers[7]).getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onSortChange).toHaveBeenLastCalledWith({ sortBy: "lastActivity", sortDirection: "asc" });
  });
});
