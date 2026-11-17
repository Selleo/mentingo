import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

const renderDialog = (noCloseButton = false) =>
  renderWith().render(
    <Dialog open>
      <DialogContent noCloseButton={noCloseButton}>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
      </DialogContent>
    </Dialog>,
  );

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage("en");
  });
});

describe("DialogContent", () => {
  it("names the close button in the current language", async () => {
    await act(async () => {
      await i18next.changeLanguage("pl");
    });
    renderDialog();
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });

  it("renders no close button with noCloseButton", () => {
    renderDialog(true);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
