import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { renderWith } from "~/utils/testUtils";

import { PhishingGate } from "./PhishingGate";
vi.mock("~/api/queries/usePhishingConfiguration", () => ({ usePhishingConfiguration: vi.fn() }));
describe("Phishing capability gate", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not mount privileged content when entitlement is disabled", () => {
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: false },
      isPending: false,
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);
    const content = vi.fn(() => <div>Campaign controls</div>);
    renderWith().render(<PhishingGate>{<Child onMount={content} />}</PhishingGate>);
    expect(content).not.toHaveBeenCalled();
    expect(screen.queryByText("Campaign controls")).not.toBeInTheDocument();
  });
  it("shows entitled content", () => {
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: true },
      isPending: false,
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);
    renderWith().render(
      <PhishingGate>
        <div>Campaign controls</div>
      </PhishingGate>,
    );
    expect(screen.getByText("Campaign controls")).toBeInTheDocument();
  });
  it("keeps content hidden when configuration fails", () => {
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePhishingConfiguration>);
    renderWith().render(
      <PhishingGate>
        <div>Campaign controls</div>
      </PhishingGate>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Campaign controls")).not.toBeInTheDocument();
  });
});
function Child({ onMount }: { onMount: () => React.ReactNode }) {
  return onMount();
}
