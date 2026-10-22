import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "./CompetenciesStates";

describe("Competencies workspace states", () => {
  it("uses the shared skeleton pattern for loading", () => {
    renderWith().render(<CompetenciesLoading label="Loading competencies" />);

    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByText("Loading competencies")).toHaveClass("sr-only");
  });

  it("uses the shared error page with a retry action", async () => {
    const onRetry = vi.fn();
    renderWith().render(
      <CompetenciesError title="Competencies unavailable" actionLabel="Retry" onRetry={onRetry} />,
    );

    expect(screen.getByRole("heading", { name: "Competencies unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses the shared dashed empty state pattern when disabled", () => {
    renderWith().render(<CompetenciesEmpty message="Competencies are unavailable" />);

    expect(screen.getByText("Competencies are unavailable")).toHaveClass("border-dashed");
  });
});
