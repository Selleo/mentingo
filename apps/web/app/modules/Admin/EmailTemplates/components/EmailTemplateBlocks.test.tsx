import { fireEvent, screen, within, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE } from "../emailTemplates.constants";
import { createEmailTemplateBlock } from "../emailTemplates.utils";

import { EmailTemplateBlocks } from "./EmailTemplateBlocks";

describe("EmailTemplateBlocks", () => {
  const blocks = [createEmailTemplateBlock("image"), createEmailTemplateBlock("spacer")];
  const renderBlocks = (disabled = false) => {
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        blocks={blocks}
        variables={[]}
        disabled={disabled}
        onChange={onChange}
        onUpload={onUpload}
      />,
    );
    return { onChange, onUpload };
  };

  it("selects thin dividers from the outline and updates their height", async () => {
    const onChange = vi.fn();
    const scrollIntoView = vi.fn();
    const props = { variables: [], disabled: false, onChange, onUpload: vi.fn() };
    const { rerender } = renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks {...props} blocks={[{ type: "divider" }, { type: "divider" }]} />,
    );
    const divider = screen.getByRole("region", { name: "Divider 2" });
    divider.scrollIntoView = scrollIntoView;
    const outline = screen.getByRole("navigation", { name: "Table of contents" });
    await userEvent.setup().click(within(outline).getByRole("button", { name: "2. Divider" }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(within(outline).getByRole("button", { name: "2. Divider" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const height = screen.getByRole("spinbutton", { name: "Divider height (px)" });
    expect(height).toHaveValue(1);
    fireEvent.change(height, { target: { value: "8" } });
    expect(onChange).toHaveBeenLastCalledWith([
      { type: "divider" },
      { type: "divider", attrs: { height: 8 } },
    ]);
    rerender(<EmailTemplateBlocks {...props} blocks={onChange.mock.lastCall![0]} />);
    expect(screen.getByRole("region", { name: "Divider 2" }).querySelector("hr")).toHaveStyle({
      borderTopWidth: "8px",
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Preview" }));
    expect(outline.closest("aside")).toHaveClass("hidden");
  });

  it("removes blocks from the outline while preserving the other block's selection", async () => {
    const onChange = vi.fn();
    const props = { variables: [], disabled: false, onChange, onUpload: vi.fn() };
    const { rerender } = renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        {...props}
        blocks={[{ type: "divider" }, { type: "spacer", attrs: { height: 24 } }]}
      />,
    );
    screen.getByRole("region", { name: "Spacer 2" }).scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const outline = screen.getByRole("navigation", { name: "Table of contents" });
    await user.click(within(outline).getByRole("button", { name: "2. Spacer" }));
    await user.click(within(outline).getByRole("button", { name: "Remove block: 1. Divider" }));
    expect(onChange).toHaveBeenLastCalledWith([{ type: "spacer", attrs: { height: 24 } }]);
    rerender(<EmailTemplateBlocks {...props} blocks={onChange.mock.lastCall![0]} />);
    expect(within(outline).getByRole("button", { name: "1. Spacer" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await user.click(within(outline).getByRole("button", { name: "Remove block: 1. Spacer" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    rerender(<EmailTemplateBlocks {...props} blocks={[]} />);
    expect(within(outline).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("disables editing and uploads for defaults", () => {
    renderBlocks(true);
    expect(screen.getByRole("button", { name: "Image" })).toBeDisabled();
    expect(screen.queryByLabelText("Upload image")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove block/ })).not.toBeInTheDocument();
  });

  it("marks the empty block with an inline reason after validation and clears it when fixed", () => {
    const props = {
      variables: [],
      disabled: false,
      onChange: vi.fn(),
      onUpload: vi.fn(),
      showValidationErrors: true,
    };
    const { rerender } = renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks {...props} blocks={[createEmailTemplateBlock("text")]} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This block is empty.");
    expect(screen.getByRole("region", { name: "Text 1" })).toHaveClass("ring-destructive");
    rerender(
      <EmailTemplateBlocks
        {...props}
        blocks={[
          {
            type: "text",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
          },
        ]}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("can select an empty text block again after selecting another block", async () => {
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        blocks={[createEmailTemplateBlock("text"), createEmailTemplateBlock("spacer")]}
        variables={[]}
        disabled={false}
        onChange={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit block Text" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Rich text content" })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Edit block Spacer" }));
    await user.click(screen.getByRole("button", { name: "Edit block Text" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Rich text content" })).toHaveFocus(),
    );
  });

  it("moves, duplicates and removes blocks without altering the input", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBlocks();
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    expect(onChange).toHaveBeenLastCalledWith([blocks[1], blocks[0]]);
    await user.click(screen.getAllByRole("button", { name: "Duplicate block" })[0]);
    expect(onChange).toHaveBeenLastCalledWith([blocks[0], blocks[0], blocks[1]]);
    await user.click(screen.getAllByRole("button", { name: "Remove block" })[0]);
    expect(onChange).toHaveBeenLastCalledWith([blocks[1]]);
    expect(blocks).toHaveLength(2);
  });

  it("accepts an image upload and retains the block index", async () => {
    const { onUpload } = renderBlocks();
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit block Image" }));
    expect(
      within(screen.getByRole("complementary", { name: "Block settings" })).getByLabelText(
        "Upload image",
      ),
    ).toBeInTheDocument();
    const file = new File(["image"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload image"), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("adds a block from the palette", async () => {
    const { onChange } = renderBlocks();
    await userEvent.setup().click(screen.getByRole("button", { name: "Button" }));
    expect(onChange).toHaveBeenCalledWith([...blocks, createEmailTemplateBlock("button")]);
  });

  it("keeps long variable tokens on one line and inserts the full token", async () => {
    const onChange = vi.fn();
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        blocks={[]}
        disabled={false}
        variables={[
          {
            key: "formatted_course_due_date",
            label: "Due date",
            type: "text",
            sampleValue: "30 September 2026",
          },
        ]}
        onChange={onChange}
        onUpload={vi.fn()}
      />,
    );
    const variable = screen.getByRole("button", { name: "{{ formatted_course_due_date }}" });
    expect(variable).toHaveClass("whitespace-nowrap");
    expect(variable).toHaveAttribute("draggable", "true");
    const setData = vi.fn();
    fireEvent.dragStart(variable, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith(
      EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE,
      "formatted_course_due_date",
    );
    await userEvent.setup().click(variable);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "text",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "{{ formatted_course_due_date }}" }],
          },
        ],
      }),
    ]);
  });

  it("switches the visual canvas between desktop and mobile widths", async () => {
    renderBlocks();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Mobile/ }));
    expect(screen.getByRole("button", { name: /Mobile/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Desktop/ }));
    expect(screen.getByRole("button", { name: /Desktop/ })).toHaveAttribute("aria-pressed", "true");
  });

  it.each([false, true])(
    "toggles inline preview and both sidebars (readonly: %s)",
    async (readonly) => {
      const { onChange } = renderBlocks(readonly);
      const user = userEvent.setup();
      const sidebars = screen.getAllByRole("complementary");
      const preview = screen.getByRole("button", { name: "Preview" });
      expect(sidebars).toHaveLength(2);
      await user.click(preview);
      expect(preview).toHaveAttribute("aria-pressed", "true");
      sidebars.forEach((sidebar) => expect(sidebar).toHaveClass("hidden"));
      expect(screen.queryByRole("button", { name: /^Remove block/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Mobile/ }));
      expect(screen.getByRole("button", { name: /Mobile/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(preview);
      expect(preview).toHaveAttribute("aria-pressed", "false");
      sidebars.forEach((sidebar) => expect(sidebar).not.toHaveClass("hidden"));
      expect(screen.queryAllByRole("button", { name: "Remove block" })).toHaveLength(
        readonly ? 0 : 2,
      );
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("renders trailing footers outside the white card and body copy below the brand background", () => {
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        blocks={[createEmailTemplateBlock("text"), createEmailTemplateBlock("footer")]}
        variables={[]}
        disabled={false}
        onChange={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    const body = screen.getByRole("region", { name: "Text 1" }).parentElement;
    const footer = screen.getByRole("region", { name: "Footer 2" }).parentElement;
    expect(body).toHaveClass("bg-white", "rounded-b-3xl");
    expect(body?.closest("td[rowspan]")).toHaveAttribute("rowspan", "2");
    expect(footer).not.toHaveClass("bg-white");
    expect(footer).not.toHaveClass("py-11");
  });

  it("spans the complete card across two solid background rows, matching sent emails", () => {
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlocks
        blocks={[
          createEmailTemplateBlock("header"),
          createEmailTemplateBlock("heading"),
          createEmailTemplateBlock("text"),
          createEmailTemplateBlock("button"),
        ]}
        variables={[]}
        disabled={false}
        primaryColor="#5345ad"
        onChange={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    const card = screen.getAllByRole("region")[0].closest("td[rowspan]");
    expect(card).toHaveAttribute("rowspan", "2");
    const table = card?.closest("table");
    const rows = table?.querySelectorAll(":scope > tbody > tr");
    expect(rows).toHaveLength(2);
    expect(rows?.[0].firstElementChild).toHaveStyle({ backgroundColor: "#5345ad" });
    expect(rows?.[1].firstElementChild).toHaveStyle({ backgroundColor: "#fafafa" });
    screen.getAllByRole("region").forEach((block) => {
      expect(block.closest("td[rowspan]")).toBe(card);
    });
  });

  it("inserts a block at the selected plus button", async () => {
    const { onChange } = renderBlocks();
    const user = userEvent.setup();
    const insertion = screen
      .getAllByRole("button", { name: /Add block after selection/ })[0]
      .closest("[data-testid]");
    expect(insertion).toHaveClass("absolute", "opacity-0");
    await user.hover(screen.getByRole("button", { name: "Edit block Image" }));
    expect(insertion).toHaveClass("opacity-100", "pointer-events-auto");
    await user.click(screen.getAllByRole("button", { name: /Add block after selection/ })[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Divider" }));
    expect(onChange).toHaveBeenCalledWith([createEmailTemplateBlock("divider"), ...blocks]);
  });
});
