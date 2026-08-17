import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { packDashboardWidgets } from "./dashboardGrid.utils";

describe("packDashboardWidgets", () => {
  it("places fixed semantic spans in stable row-major order", () => {
    const placements = packDashboardWidgets(
      [
        { id: DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE, size: "2x2", order: 0 },
        { id: DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES, size: "1x2", order: 1 },
        { id: DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION, size: "1x1", order: 2 },
      ],
      4,
    );

    expect(placements).toEqual([
      expect.objectContaining({ column: 0, row: 0, columns: 2, rows: 2 }),
      expect.objectContaining({ column: 2, row: 0, columns: 1, rows: 2 }),
      expect.objectContaining({ column: 3, row: 0, columns: 1, rows: 1 }),
    ]);
  });

  it("caps horizontal spans on narrow screens without changing row height", () => {
    const [placement] = packDashboardWidgets(
      [{ id: DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE, size: "2x2", order: 0 }],
      1,
    );

    expect(placement).toMatchObject({ column: 0, row: 0, columns: 1, rows: 2 });
  });
});
