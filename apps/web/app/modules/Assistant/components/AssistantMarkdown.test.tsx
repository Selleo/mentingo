import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AssistantMarkdown } from "./AssistantMarkdown";

import type { AssistantSource } from "../assistant.types";

const renderMarkdown = (text: string, sources?: AssistantSource[]) =>
  renderWith().render(
    <MemoryRouter>
      <AssistantMarkdown text={text} sources={sources} />
    </MemoryRouter>,
  );

describe("restricted Assistant markdown", () => {
  it.each([
    "![preview](https://attacker.invalid/pixel)",
    "![preview](http://attacker.invalid/pixel)",
    "![preview](//attacker.invalid/pixel)",
    "![preview][p]\n\n[p]: //attacker.invalid/pixel",
    "![preview][p]\n\n[p]: https://attacker.invalid/pixel",
    "![preview](data:image/svg+xml;base64,PHN2Zy8+)",
  ])("replaces images with text without rendering a fetchable image (%s)", (text) => {
    const { container } = renderMarkdown(text);
    expect(container.querySelector("img, picture, source, svg, iframe")).toBeNull();
    expect(screen.getByText("preview")).toBeInTheDocument();
  });

  it.each([
    "[unverified](/course/not-verified)",
    "[unverified](//attacker.invalid/collect)",
    "[unverified](http://attacker.invalid/collect)",
    "[unverified](https://attacker.invalid/collect)",
    "[unverified](javascript:alert%281%29)",
    "[unverified](data:text/html,example)",
    "[unverified][target]\n\n[target]: //attacker.invalid/collect",
  ])("keeps links without verified metadata noninteractive (%s)", (text) => {
    renderMarkdown(text);
    expect(screen.getByText("unverified")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never interprets raw HTML as executable or fetchable elements", () => {
    const { container } = renderMarkdown(
      '<img src="//attacker.invalid/pixel" onerror="alert(1)"><iframe src="https://attacker.invalid"></iframe><script>alert(1)</script><a href="javascript:alert(1)">raw link</a>',
    );
    expect(container.querySelector("img, iframe, script, a, [onerror]")).toBeNull();
  });

  it("preserves exact verified internal navigation and its existing metadata preview", async () => {
    const user = userEvent.setup();
    renderMarkdown(
      "See [Onboarding](https://tenant.example/course/verified) and [invented](/course/other).",
      [
        {
          title: "Onboarding",
          url: "https://tenant.example/course/verified",
          entityType: "course",
          description: "Authorized course summary",
        },
      ],
    );
    const link = screen.getByRole("link", { name: "Onboarding" });
    expect(link).toHaveAttribute("href", "/course/verified");
    expect(screen.getByText("invented").closest("a")).toBeNull();
    await user.hover(link);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Authorized course summary");
  });

  it.each([
    "//attacker.invalid/pixel",
    "https://tenant.example//attacker.invalid/pixel",
    "https://user:password@tenant.example/course/verified",
    "javascript:alert%281%29",
    "/\\attacker.invalid/pixel",
  ])("rejects unsafe source metadata instead of creating a destination (%s)", (url) => {
    renderMarkdown(`[unsafe](${url})`, [{ title: "Unsafe", url }]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
