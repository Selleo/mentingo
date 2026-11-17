import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BaseEditor } from "./Editor";

const renderToolbarButtons = async (compactToolbar: boolean) => {
  render(<BaseEditor content="<p>Hi</p>" onChange={vi.fn()} compactToolbar={compactToolbar} />);
  await screen.findByRole("textbox");

  return within(screen.getByRole("toolbar")).getAllByRole("button");
};

describe("base editor compact toolbar", () => {
  it("keeps only inline formatting and lists", async () => {
    // bold, italic, strikethrough, link, bullet list, ordered list
    expect(await renderToolbarButtons(true)).toHaveLength(6);
  });

  it("shows the full toolbar by default", async () => {
    expect((await renderToolbarButtons(false)).length).toBeGreaterThan(6);
  });
});
