import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { AiMentorQualityCheckDialog } from "./AiMentorQualityCheckDialog";

describe("AiMentorQualityCheckDialog", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("offers an explicit cancel action while quality validation is running", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWith().render(
      <AiMentorQualityCheckDialog isLoading onOpenChange={vi.fn()} onCancel={onCancel} />,
    );

    expect(screen.getByText("Checking the current configuration…")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders creator-facing labels for schema field references", () => {
    renderWith().render(
      <AiMentorQualityCheckDialog
        onOpenChange={vi.fn()}
        result={{
          passed: false,
          summary: "The configuration needs changes.",
          issues: [
            {
              code: "role_mismatch",
              message: "aiRole does not match the scenario.",
              correction: "Update aiRole to identify the Mentor clearly.",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("AI role does not match the scenario.")).toBeVisible();
    expect(screen.getByText("Update AI role to identify the Mentor clearly.")).toBeVisible();
  });
});
