export type UiMessageRole = "system" | "user" | "assistant";

export type UiMessageTextPart = {
  type: "text";
  text: string;
};

export type UiMessageTextSource = {
  parts?: unknown;
};

export type TextUiMessage<TRole extends string = UiMessageRole> = {
  id: string;
  role: TRole;
  parts: UiMessageTextPart[];
};

export const getUiMessageText = (message?: UiMessageTextSource): string => {
  if (!message || !Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .map((part) => {
      const textPart = part as Partial<UiMessageTextPart>;
      return textPart.type === "text" && typeof textPart.text === "string" ? textPart.text : "";
    })
    .join("");
};

export const toUiMessageRole = <TRole extends string = UiMessageRole>(role: string): TRole => {
  return (role === "assistant" || role === "system" ? role : "user") as TRole;
};

export const createTextUiMessage = <TMessage = TextUiMessage>({
  id,
  role,
  content,
}: {
  id: string;
  role: string;
  content: string;
}): TMessage =>
  ({
    id,
    role,
    parts: [{ type: "text", text: content }],
  }) as TMessage;
