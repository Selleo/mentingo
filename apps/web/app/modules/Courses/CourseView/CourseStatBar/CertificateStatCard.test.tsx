import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CertificateStatCard from "./CertificateStatCard";

describe("CertificateStatCard", () => {
  it("opens certificate settings for admins even when certificates are disabled", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    renderWith().render(
      <CertificateStatCard hasCertificate={false} isAdminExperience onOpen={onOpen} />,
    );

    const card = screen.getByRole("button", { name: /certificate disabled/i });

    expect(card).toBeEnabled();
    expect(card).toHaveClass("opacity-50");

    await user.click(card);

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows learner certificate information without making the card interactive", () => {
    renderWith().render(
      <CertificateStatCard hasCertificate isAdminExperience={false} onOpen={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /certificate upon completion/i })).toBeDisabled();
  });
});
