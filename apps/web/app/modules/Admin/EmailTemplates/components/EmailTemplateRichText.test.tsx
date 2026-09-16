import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { getEmailTemplateVariableRanges } from "../emailTemplateVariableHighlight.utils";

import { EmailTemplateRichText } from "./EmailTemplateRichText";

describe("email variable highlighting", () => {
  const variables = [
    { key: "course_name", label: "Course", type: "text" as const, sampleValue: "Example" },
  ];

  it("recognizes only complete variables supported by the event", () => {
    expect(
      getEmailTemplateVariableRanges("{{course_name}} {{ unknown }} {{course_name", variables),
    ).toEqual([{ from: 0, to: 15 }]);
  });

  it("decorates variables across formatting marks without changing content", async () => {
    const onChange = vi.fn();
    renderWith().render(
      <EmailTemplateRichText
        inline
        disabled={false}
        variables={variables}
        onChange={onChange}
        content={[
          {
            type: "paragraph",
            content: [
              { type: "text", text: "{{ course_" },
              { type: "text", text: "name }}", marks: [{ type: "bold" }] },
              { type: "text", text: " {{ unknown }}" },
            ],
          },
        ]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox").querySelector(".text-primary-700")).not.toBeNull(),
    );
    const editor = screen.getByRole("textbox");
    expect(
      Array.from(editor.querySelectorAll(".text-primary-700"))
        .map((node) => node.textContent)
        .join(""),
    ).toBe("{{ course_name }}");
    expect(editor).not.toHaveClass("min-h-8");
    expect(editor).toHaveClass("flow-root");
    expect(editor).not.toHaveClass("[&_p]:min-h-5");
    for (const [paragraphs] of onChange.mock.calls) {
      expect(paragraphs).toEqual([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "{{ course_", marks: [] },
            { type: "text", text: "name }}", marks: [{ type: "bold" }] },
            { type: "text", text: " {{ unknown }}", marks: [] },
          ],
        },
      ]);
    }
  });
});
