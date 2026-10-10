import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseDescriptionSummary } from "./CourseDescriptionSummary";

describe("lightweight course descriptions", () => {
  it("keeps basic summary formatting and layout classes", () => {
    const { container } = render(
      <CourseDescriptionSummary
        className="line-clamp-3"
        content="<p>Learn <strong>skills</strong><br>and <em>practice</em>.</p>"
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("skills");
    expect(container.querySelector("em")?.textContent).toBe("practice");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.firstElementChild?.className).toBe("line-clamp-3");
  });
  it.each([
    '<p style="background-image:url(https://attacker.example/private)">Learn</p>',
    '<img src="https://attacker.example/private" onerror="alert(1)">Learn',
    '<iframe src="/api/uploaded-active-html" srcdoc="payload"></iframe>Learn',
    '<svg onload="alert(1)"><image href="https://attacker.example/private"></image></svg>Learn',
    '<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">Learn</a>',
  ])("renders no automatic requests or active attributes from %s", (content) => {
    const { container } = render(<CourseDescriptionSummary content={content} />);
    expect(container.textContent).toContain("Learn");
    expect(container.querySelector("img,iframe,svg,script,object,embed,a")).toBeNull();
    for (const node of container.querySelectorAll("*")) expect(node.attributes.length).toBe(0);
    expect(container.innerHTML).not.toContain("attacker.example");
  });
});
