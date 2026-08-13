import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ActivityLogMetadata } from "./ActivityLogMetadata";

describe("ActivityLogMetadata", () => {
  it("renders metadata as flat label and value sections", () => {
    renderWith().render(
      <ActivityLogMetadata
        metadata={{
          before: { title: "Old title" },
          after: { title: "New title" },
          context: { language: "en" },
        }}
      />,
    );

    for (const label of ["Before", "After", "Context"]) {
      const section = screen.getByText(label).parentElement;

      expect(section).not.toHaveClass("border", "rounded-2xl", "bg-white");
    }
  });

  it("removes only the outermost braces from metadata objects", () => {
    const { container } = renderWith().render(
      <ActivityLogMetadata
        metadata={{
          context: {
            courseTitle: "Safety onboarding",
            enrollment: { source: "admin" },
          },
        }}
      />,
    );
    const metadata = container.querySelector("pre");

    expect(metadata).toHaveTextContent('"courseTitle": "Safety onboarding"');
    expect(metadata).toHaveTextContent('"enrollment": {');
    expect(metadata?.textContent?.trim().startsWith("{")).toBe(false);
    expect(metadata?.textContent?.trim().endsWith("}")).toBe(true);
  });

  it("aligns top-level properties after removing the outermost braces", () => {
    const { container } = renderWith().render(
      <ActivityLogMetadata
        metadata={{
          context: {
            sentCount: "1",
            skippedCount: "0",
            recipientEmails: ["person@example.com"],
          },
        }}
      />,
    );

    expect(container.querySelector("pre")?.textContent).toBe(
      '"sentCount": "1",\n"skippedCount": "0",\n"recipientEmails": [\n  "person@example.com"\n]',
    );
  });

  it("renders JSON-encoded object and array strings as structured metadata", () => {
    const { container } = renderWith().render(
      <ActivityLogMetadata
        metadata={{
          after: {
            groups: '[{"id":"11111111-1111-4111-8111-111111111111","name":"Example group"}]',
          },
        }}
      />,
    );
    const metadata = container.querySelector("pre");

    expect(metadata).toHaveTextContent('"groups": [');
    expect(metadata).toHaveTextContent('"name": "Example group"');
    expect(metadata?.textContent).not.toContain('\\"');
  });
});
