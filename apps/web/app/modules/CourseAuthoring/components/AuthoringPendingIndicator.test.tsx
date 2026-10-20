import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringPendingIndicator } from "./AuthoringPendingIndicator";

describe("AuthoringPendingIndicator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks elapsed time and explains a long-running phase", () => {
    renderWith().render(<AuthoringPendingIndicator label="Preparing your response…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing your response…");
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.queryByText(/This can take up to a minute/)).toBeNull();

    act(() => vi.advanceTimersByTime(16_000));

    expect(screen.getByText("0:16")).toBeInTheDocument();
    expect(screen.getByText(/This can take up to a minute/)).toBeInTheDocument();
  });
});
