import { act, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import CertificateStatCard from "./CertificateStatCard";

describe("CertificateStatCard", () => {
  afterEach(async () => {
    await act(async () => {
      await i18next.changeLanguage("en");
    });
  });

  it("opens certificate settings for admins even when certificates are disabled", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    renderWith().render(
      <CertificateStatCard hasCertificate={false} isAdminExperience onOpen={onOpen} />,
    );

    const card = screen.getByRole("button", { name: /certificate disabled/i });

    expect(card).toBeEnabled();
    expect(card).toHaveClass("opacity-50");
    expect(card).toHaveClass("shadow-sm");
    expect(card).not.toHaveClass("shadow-lg");

    await user.click(card);

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows learner certificate information without making the card interactive", () => {
    renderWith().render(
      <CertificateStatCard hasCertificate isAdminExperience={false} onOpen={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /certificate not issued yet/i })).toBeDisabled();
  });

  it.each([
    ["en", "Issued", "Expires"],
    ["pl", "Wydano", "Wygasa"],
  ])(
    "labels both certificate dates in %s and opens the existing preview",
    async (language, dateLabel, expiryLabel) => {
      await i18next.changeLanguage(language);
      const onOpen = vi.fn();
      renderWith().render(
        <CertificateStatCard
          hasCertificate
          isAdminExperience={false}
          isCertificateAvailable
          completionDate="19.10.2026"
          expiryDate="19.10.2027"
          onOpen={onOpen}
        />,
      );

      expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
        dateLabel,
        expiryLabel,
      ]);
      expect(screen.getAllByRole("definition").map((date) => date.textContent)).toEqual([
        "19.10.2026",
        "19.10.2027",
      ]);
      await userEvent.setup().click(screen.getByRole("button"));
      expect(onOpen).toHaveBeenCalledOnce();
    },
  );

  it("only shows the date for a certificate without expiry", () => {
    renderWith().render(
      <CertificateStatCard
        hasCertificate
        isAdminExperience={false}
        isCertificateAvailable
        completionDate="19.10.2026"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("term")).toHaveLength(1);
    expect(screen.getByRole("term")).toHaveTextContent("Issued");
    expect(screen.getByRole("definition")).toHaveTextContent("19.10.2026");
    expect(screen.queryByText("Expires")).not.toBeInTheDocument();
  });
});
