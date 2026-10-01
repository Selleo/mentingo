import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE } from "../emailTemplates.constants";

import { EmailTemplateTextField } from "./EmailTemplateTextField";

describe("EmailTemplateTextField", () => {
  it("highlights only valid subject variables while keeping the input value unchanged", () => {
    const value = "Hello {{ course_name }} {{ unknown }}";
    const { container } = renderWith().render(
      <EmailTemplateTextField
        label="Subject"
        value={value}
        onChange={vi.fn()}
        highlightVariables
        variables={[{ key: "course_name", label: "Course", type: "text", sampleValue: "Example" }]}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue(value);
    expect(container.querySelectorAll(".text-primary-700")).toHaveLength(1);
    expect(container.querySelector(".text-primary-700")).toHaveTextContent("{{ course_name }}");
  });
  it("accepts known variables at the caret without showing a picker", () => {
    const onChange = vi.fn();
    renderWith().render(
      <EmailTemplateTextField
        label="Link"
        value=""
        onChange={onChange}
        variables={[
          {
            key: "course_link",
            label: "Course link",
            type: "url",
            sampleValue: "https://example.com",
          },
        ]}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Link" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.drop(input, {
      dataTransfer: {
        getData: (type: string) =>
          type === EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE ? "course_link" : "",
      },
    });
    expect(onChange).toHaveBeenCalledWith("{{ course_link }}");
    onChange.mockClear();
    fireEvent.drop(input, { dataTransfer: { getData: () => "unknown_variable" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
