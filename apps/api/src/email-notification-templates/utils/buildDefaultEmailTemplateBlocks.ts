import { randomUUID } from "crypto";

import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  SUPPORTED_LANGUAGES,
  TENANT_LOGO_VARIABLE,
} from "@repo/shared";

import type { EmailTemplateBlocks, SupportedLanguages } from "@repo/shared";

const DEFAULT_BUTTON_URL = "";
const DEFAULT_TENANT_LOGO_HEIGHT = "32";

const DEFAULT_PLACEHOLDER_TEXT: Record<
  SupportedLanguages,
  {
    heading: string;
    paragraph: string;
    button: string;
    footer: string;
  }
> = {
  [SUPPORTED_LANGUAGES.EN]: {
    heading: "Heading 2",
    paragraph: "Paragraph text",
    button: "Button",
    footer: "Footer text",
  },
  [SUPPORTED_LANGUAGES.PL]: {
    heading: "Nagłówek 2",
    paragraph: "Tekst akapitu",
    button: "Przycisk",
    footer: "Tekst stopki",
  },
  [SUPPORTED_LANGUAGES.DE]: {
    heading: "Überschrift 2",
    paragraph: "Absatztext",
    button: "Schaltfläche",
    footer: "Fußzeilentext",
  },
  [SUPPORTED_LANGUAGES.LT]: {
    heading: "Antraštė 2",
    paragraph: "Pastraipos tekstas",
    button: "Mygtukas",
    footer: "Poraštės tekstas",
  },
  [SUPPORTED_LANGUAGES.CS]: {
    heading: "Nadpis 2",
    paragraph: "Text odstavce",
    button: "Tlačítko",
    footer: "Text zápatí",
  },
  [SUPPORTED_LANGUAGES.ES]: {
    heading: "Encabezado 2",
    paragraph: "Texto de párrafo",
    button: "Botón",
    footer: "Texto del pie de página",
  },
};

const textNode = (text: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.TEXT,
  text,
});

const withUuid = (attrs?: Record<string, unknown>) => ({
  [EMAIL_TEMPLATE_NODE_UUID_ATTR]: randomUUID(),
  ...attrs,
});

export const buildDefaultEmailTemplateBlocks = (
  baseLanguage: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
): EmailTemplateBlocks => {
  const placeholders =
    DEFAULT_PLACEHOLDER_TEXT[baseLanguage] ?? DEFAULT_PLACEHOLDER_TEXT[SUPPORTED_LANGUAGES.EN];

  return {
    type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
    content: [
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
        attrs: withUuid({
          src: TENANT_LOGO_VARIABLE,
          alignment: "center",
          width: null,
          height: DEFAULT_TENANT_LOGO_HEIGHT,
        }),
      },
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.HEADING,
        attrs: withUuid({ level: 2 }),
        content: [textNode(placeholders.heading)],
      },
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
        attrs: withUuid(),
        content: [textNode(placeholders.paragraph)],
      },
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
        attrs: withUuid({
          text: placeholders.button,
          url: DEFAULT_BUTTON_URL,
          alignment: "left",
          variant: "filled",
          borderRadius: "smooth",
        }),
      },
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.HORIZONTAL_RULE,
        attrs: withUuid(),
      },
      {
        type: EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
        attrs: withUuid(),
        content: [textNode(placeholders.footer)],
      },
    ],
  };
};
