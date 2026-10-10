import { screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ContentEditor } from "~/components/RichText/Editor";
import { ReadOnlyFrame } from "~/modules/Admin/EditCourse/CourseLessons/components/ReadOnlyFrame";
import { renderWith } from "~/utils/testUtils";

it("keeps the standard image node at its insertion point in a read-only Tiptap editor", async () => {
  const onChange = vi.fn();
  renderWith({}).render(
    <ReadOnlyFrame>
      <ContentEditor
        editable={false}
        onChange={onChange}
        content={
          '<p>Before image</p><div data-node-type="image" data-src="blob:diagram" data-alt="Architecture diagram"></div><p>After image</p>'
        }
      />
    </ReadOnlyFrame>,
  );
  const editor = screen.getByRole("textbox");
  expect(editor).toHaveAttribute("contenteditable", "false");
  expect(editor).toHaveAttribute("aria-readonly", "true");
  await waitFor(() =>
    expect(screen.getByRole("link", { name: "Architecture diagram" })).toBeInTheDocument(),
  );
  const link = screen.getByRole("link", { name: "Architecture diagram" });
  expect(link).toHaveAttribute("href", "blob:diagram");
  expect(link).toHaveAttribute("data-read-only-allow");
  expect(editor).toContainElement(link);
  expect(
    screen.getByText("Before image").compareDocumentPosition(link) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    link.compareDocumentPosition(screen.getByText("After image")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it("shows a pending image at its insertion point without an empty link", async () => {
  renderWith({}).render(
    <ContentEditor
      editable={false}
      onChange={vi.fn()}
      content={
        '<p>Before pending</p><div data-node-type="image" data-authoring-asset-id="11111111-1111-4111-8111-111111111111" data-alt="Pending diagram"></div><p>After pending</p>'
      }
    />,
  );
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Pending diagram");
  expect(screen.queryByText(/Loading preview/)).not.toBeInTheDocument();
  expect(status).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("textbox")).toContainElement(status);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(
    screen.getByText("Before pending").compareDocumentPosition(status) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    status.compareDocumentPosition(screen.getByText("After pending")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
