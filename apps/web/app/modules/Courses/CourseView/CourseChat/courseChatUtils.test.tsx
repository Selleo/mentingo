import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMentionedUserIds, renderMessageContent } from "./courseChatUtils";

const buildUser = (id: string, firstName: string, lastName: string) => ({
  id,
  firstName,
  lastName,
  avatarReference: null,
});

const kowal = buildUser("kowal", "Jan", "Kowal");
const kowalski = buildUser("kowalski", "Jan", "Kowalski");
const users = [kowal, kowalski];

describe("getMentionedUserIds", () => {
  it("does not treat a longer name as a mention of a shorter one", () => {
    expect(getMentionedUserIds("@Jan Kowalski please check", users)).toEqual([kowalski.id]);
    expect(getMentionedUserIds("@Jan Kowal, and @Jan Kowalski too", users)).toEqual([
      kowal.id,
      kowalski.id,
    ]);
  });

  it("ignores names that are not written as mentions", () => {
    expect(getMentionedUserIds("Jan Kowalski wrote this", users)).toEqual([]);
    expect(getMentionedUserIds("@Jan Kowalskiego nie ma", users)).toEqual([]);
  });
});

describe("renderMessageContent", () => {
  it("highlights the whole mention, not a shorter name inside it", () => {
    render(<p>{renderMessageContent("Hi @Jan Kowalski!", users)}</p>);

    expect(screen.getByText("@Jan Kowalski")).toHaveClass("text-primary-700");
    expect(screen.queryByText("@Jan Kowal")).not.toBeInTheDocument();
  });

  it("returns plain text when nobody can be mentioned", () => {
    expect(renderMessageContent("Hi @Jan Kowalski!", [])).toBe("Hi @Jan Kowalski!");
  });
});
