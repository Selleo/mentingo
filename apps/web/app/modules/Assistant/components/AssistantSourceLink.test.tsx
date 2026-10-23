import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AssistantSourceLink } from "./AssistantSourceLink";

import type { ReactElement } from "react";

function LocationView() {
  return <output data-testid="route-location">{useLocation().pathname}</output>;
}

const renderView = (element: ReactElement) => {
  const result = renderWith().render(
    <MemoryRouter>
      {element}
      <LocationView />
    </MemoryRouter>,
  );
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(<MemoryRouter>{next}</MemoryRouter>),
  };
};

const source = {
  title: "Audrey Student",
  url: "/admin/users/student-1",
  entityType: "user" as const,
  description: "A learner in the onboarding group.",
};

describe("AssistantSourceLink", () => {
  it("shows authorized metadata on hover and keeps the destination clickable", async () => {
    const user = userEvent.setup();
    renderView(<AssistantSourceLink source={source}>Audrey</AssistantSourceLink>);
    const link = screen.getByRole("link", { name: "Audrey" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.hover(link);
    const preview = await screen.findByRole("dialog");
    expect(within(preview).getByText("Person")).toBeVisible();
    expect(within(preview).getByText(source.title)).toBeVisible();
    expect(within(preview).getByText(source.description)).toBeVisible();
    expect(link).toHaveAttribute("href", source.url);
    expect(link).toHaveAttribute("aria-controls", preview.id);
    expect(preview.querySelector("img")).toBeNull();
  });

  it("supports keyboard focus and Escape without intercepting link navigation", async () => {
    const user = userEvent.setup();
    renderView(<AssistantSourceLink source={source}>Audrey</AssistantSourceLink>);
    await user.tab();
    const link = screen.getByRole("link", { name: "Audrey" });
    expect(link).toHaveFocus();
    expect(await screen.findByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(link).toHaveFocus();
    expect(link).not.toHaveAttribute("target");
  });

  it("lets the pointer enter the preview and uses React routing from its footer", async () => {
    const user = userEvent.setup();
    renderView(
      <AssistantSourceLink
        source={{ ...source, url: "https://tenant1.lms.localhost/admin/users/student-1" }}
      >
        Audrey
      </AssistantSourceLink>,
    );
    const trigger = screen.getByRole("link", { name: "Audrey" });
    await user.hover(trigger);
    const preview = await screen.findByRole("dialog");
    const open = within(preview).getByRole("link", { name: "Open in Mentingo" });
    expect(open).toHaveAttribute("href", "/admin/users/student-1");
    expect(open).not.toHaveAttribute("target");
    await user.hover(open);
    expect(preview).toBeVisible();
    await user.click(open);
    expect(screen.getByTestId("route-location")).toHaveTextContent("/admin/users/student-1");
  });

  it("keeps the preview open when keyboard focus moves to its action", async () => {
    const user = userEvent.setup();
    renderView(<AssistantSourceLink source={source}>Audrey</AssistantSourceLink>);
    await user.tab();
    const preview = await screen.findByRole("dialog");
    await user.tab();
    expect(within(preview).getByRole("link", { name: "Open in Mentingo" })).toHaveFocus();
    expect(preview).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audrey" })).toHaveFocus();
  });

  it("supports historical sources without optional metadata", async () => {
    const user = userEvent.setup();
    renderView(
      <AssistantSourceLink source={{ title: "Onboarding", url: "/course/course-1" }}>
        Onboarding
      </AssistantSourceLink>,
    );
    await user.tab();
    const preview = await screen.findByRole("dialog");
    expect(within(preview).getByText("Reference")).toBeVisible();
    expect(within(preview).getByText("Onboarding")).toBeVisible();
  });
});
