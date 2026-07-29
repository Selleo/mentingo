import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { InlineDiagnosticNote } from "./InlineDiagnosticNote";
import { InlineDiagnosticStack } from "./InlineDiagnosticStack";

import type { EmailTemplateDiagnostic } from "@repo/shared";

const renderNote = (diagnostic: EmailTemplateDiagnostic) =>
  renderWith().render(<InlineDiagnosticNote diagnostic={diagnostic} />);

describe("InlineDiagnosticNote", () => {
  it("uses warning classes for warning diagnostics", () => {
    renderNote({ severity: "warning", reason: "footer_missing" });

    expect(screen.getByText("Footer is missing").closest("div")).toHaveClass(
      "border-yellow-200",
      "bg-yellow-50",
      "text-yellow-900",
    );
  });

  it("uses error classes for error diagnostics", () => {
    renderNote({ severity: "error", reason: "button_label_missing" });

    expect(screen.getByText("Button label is required").closest("div")).toHaveClass(
      "border-red-200",
      "bg-red-50",
      "text-red-900",
    );
  });

  it("shows a language tag when the diagnostic has a language", () => {
    renderNote({
      severity: "warning",
      reason: "unchanged_from_base",
      language: "pl",
    });

    expect(screen.getByText("[PL]")).toBeInTheDocument();
  });

  it("shows the language tag for the current or base language too", () => {
    renderNote({
      severity: "warning",
      reason: "empty_translation",
      language: "en",
    });

    expect(screen.getByText("[EN]")).toBeInTheDocument();
  });

  it("renders the translated reason label and detail", () => {
    renderNote({
      severity: "error",
      reason: "invalid_url_protocol",
      detail: "href: ftp:",
    });

    expect(screen.getByText("URL uses a disallowed protocol")).toBeInTheDocument();
    expect(screen.getByText("href: ftp:")).toBeInTheDocument();
  });
});

describe("InlineDiagnosticStack", () => {
  it("renders one note with all languages for matching translation diagnostics", () => {
    renderWith().render(
      <InlineDiagnosticStack
        diagnostics={[
          {
            severity: "warning",
            reason: "empty_translation",
            language: "en",
            nodeUuid: "node-1",
          },
          {
            severity: "warning",
            reason: "empty_translation",
            language: "de",
            nodeUuid: "node-1",
          },
          {
            severity: "warning",
            reason: "empty_translation",
            language: "pl",
            nodeUuid: "node-1",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Translation is empty")).toHaveLength(1);
    expect(screen.getByText("[EN]")).toBeInTheDocument();
    expect(screen.getByText("[DE]")).toBeInTheDocument();
    expect(screen.getByText("[PL]")).toBeInTheDocument();
  });

  it("keeps matching translation diagnostics separate when severities differ", () => {
    renderWith().render(
      <InlineDiagnosticStack
        diagnostics={[
          {
            severity: "error",
            reason: "empty_translation",
            language: "en",
            nodeUuid: "node-1",
          },
          {
            severity: "warning",
            reason: "empty_translation",
            language: "de",
            nodeUuid: "node-1",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Translation is empty")).toHaveLength(2);
    expect(screen.getByText("[EN]").closest("div")).toHaveClass("border-red-200");
    expect(screen.getByText("[DE]").closest("div")).toHaveClass("border-yellow-200");
  });
});
