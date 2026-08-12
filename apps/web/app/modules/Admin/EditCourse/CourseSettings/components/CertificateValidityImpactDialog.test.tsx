import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CertificateValidityImpactDialog } from "./CertificateValidityImpactDialog";

const renderDialog = (isEnablingValidity: boolean) =>
  renderWith().render(
    <CertificateValidityImpactDialog
      open
      impact={{ activeCertificateCount: 0, immediatelyExpiringCertificateCount: 0 }}
      isEnablingValidity={isEnablingValidity}
      onOpenChange={vi.fn()}
      onFutureOnly={vi.fn()}
      onApplyToExisting={vi.fn()}
    />,
  );

describe("CertificateValidityImpactDialog", () => {
  it("does not show the no-active-certificates message when enabling validity", () => {
    renderDialog(true);

    expect(
      screen.queryByText(
        "There are no active certificates to update right now. Future certificates will use this validity setting.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable validity" })).toBeInTheDocument();
  });

  it("shows the no-active-certificates message for later validity changes", () => {
    renderDialog(false);

    expect(
      screen.getByText(
        "There are no active certificates to update right now. Future certificates will use this validity setting.",
      ),
    ).toBeInTheDocument();
  });
});
