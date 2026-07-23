import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { InlineTextDiff } from "./InlineTextDiff";

describe("InlineTextDiff", () => {
  it("renders an added value without an empty removal marker or arrow", () => {
    const { container } = renderWith().render(
      <InlineTextDiff before="" after="Maintains professional sales tone" />,
    );

    expect(screen.getByText("Maintains professional sales tone")).toBeVisible();
    expect(container.querySelector("ins")).toBeVisible();
    expect(container.querySelector("del")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("→");
    expect(container).not.toHaveTextContent("—");
  });

  it("renders a removed value without an empty replacement marker", () => {
    const { container } = renderWith().render(
      <InlineTextDiff before="Old criterion" after={undefined} />,
    );

    expect(screen.getByText("Old criterion")).toBeVisible();
    expect(container.querySelector("del")).toBeVisible();
    expect(container.querySelector("ins")).not.toBeInTheDocument();
  });
});
