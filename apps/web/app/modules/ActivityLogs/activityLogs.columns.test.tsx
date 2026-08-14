import { describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";

import { getActivityLogsColumns } from "./activityLogs.columns";

describe("getActivityLogsColumns", () => {
  it("keeps the resource type and resource name in separate columns", () => {
    const columns = getActivityLogsColumns(i18next.t, {
      expandedRowId: null,
      onToggleRow: vi.fn(),
    });

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "resource", header: "Resource" }),
        expect.objectContaining({ accessorKey: "resourceName", header: "Resource name" }),
      ]),
    );
  });
});
