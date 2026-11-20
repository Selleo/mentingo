import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseProgressChart } from "./CourseProgressChart";

import type { ReactElement } from "react";

vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();

  // Segments render at once instead of after the entry animation.
  recharts.Pie.defaultProps = { ...recharts.Pie.defaultProps, isAnimationActive: false };

  // jsdom has no layout, so give the chart a fixed size (large enough for its 84px inner radius).
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <recharts.ResponsiveContainer width={250} height={250}>
        {children}
      </recharts.ResponsiveContainer>
    ),
  };
});

describe("CourseProgressChart", () => {
  it("names each segment with its chapter count", () => {
    renderWith().render(<CourseProgressChart chaptersCount={5} completedChaptersCount={3} />);

    expect(screen.getByRole("img", { name: "Completed chapters: 3" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Remaining chapters: 2" })).toBeInTheDocument();
  });

  it("names the empty chart as having no data", () => {
    renderWith().render(<CourseProgressChart chaptersCount={0} completedChaptersCount={0} />);

    expect(screen.getByRole("img", { name: "No data" })).toBeInTheDocument();
  });
});
