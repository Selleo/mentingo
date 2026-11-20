import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from "./toast";

describe("Toast", () => {
  it("names the close button and keeps status toasts out of a list", () => {
    renderWith().render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Saved</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
