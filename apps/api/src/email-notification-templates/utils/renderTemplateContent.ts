import { Maily } from "@maily-to/render";
import { EMAIL_TEMPLATE_NODE_TYPES, TENANT_LOGO_CID_SRC, TENANT_LOGO_VARIABLE } from "@repo/shared";
import { load as loadHtml } from "cheerio";

import { assertSafeBlockUrls } from "./assertSafeBlockUrls";
import { flattenTranslationsForRender } from "./flattenTranslationsForRender";

import type {
  EmailTemplateBlocks,
  EmailTemplateNode,
  EmailTemplateStrings,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";

export type RenderTemplateOutput = {
  language: SupportedLanguages;
  subject: string;
  html: string;
};

const CARD_MAX_WIDTH_PX = 500;
const CARD_BORDER_RADIUS_PX = 24;
const CARD_PADDING_X_PX = 50;
const CARD_PADDING_TOP_PX = 32;
const CARD_PADDING_BOTTOM_PX = 32;
const BODY_BACKGROUND = "#fafafa";
const CARD_BACKGROUND = "#ffffff";
const HEADER_PADDING_TOP_PX = 50;

export const renderTemplateContent = async (params: {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  subject: LocalizedText;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  primaryColor: string;
  tenantLogoSrc?: string | null;
  previewText?: string;
}): Promise<RenderTemplateOutput> => {
  const monolingualBlocks = flattenTranslationsForRender({
    blocks: params.blocks,
    strings: params.strings,
    language: params.language,
    baseLanguage: params.baseLanguage,
  });
  assertSafeBlockUrls(monolingualBlocks);
  replaceTenantLogoSrc(monolingualBlocks, params.tenantLogoSrc ?? TENANT_LOGO_CID_SRC);

  const maily = new Maily(monolingualBlocks as never);
  if (params.previewText) maily.setPreviewText(params.previewText);
  maily.setTheme({
    body: {
      backgroundColor: BODY_BACKGROUND,
    },
    container: {
      backgroundColor: CARD_BACKGROUND,
      maxWidth: `${CARD_MAX_WIDTH_PX}px`,
      borderRadius: `${CARD_BORDER_RADIUS_PX}px`,
      borderWidth: "0px",
      borderColor: "transparent",
      paddingTop: `${CARD_PADDING_TOP_PX}px`,
      paddingBottom: `${CARD_PADDING_BOTTOM_PX}px`,
      paddingLeft: `${CARD_PADDING_X_PX}px`,
      paddingRight: `${CARD_PADDING_X_PX}px`,
    },
  });
  const rawHtml = await maily.render();
  const html = applyEmailLayout(rawHtml, params.primaryColor);

  const localizedSubject = params.subject[params.language];
  const baseSubject = params.subject[params.baseLanguage];
  const subject =
    localizedSubject && localizedSubject.trim().length > 0 ? localizedSubject : (baseSubject ?? "");

  return {
    language: params.language,
    subject,
    html,
  };
};

const replaceTenantLogoSrc = (node: EmailTemplateNode, tenantLogoSrc: string): void => {
  if (node.type === EMAIL_TEMPLATE_NODE_TYPES.IMAGE && node.attrs?.src === TENANT_LOGO_VARIABLE) {
    node.attrs = {
      ...node.attrs,
      src: tenantLogoSrc,
    };
  }

  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    replaceTenantLogoSrc(child, tenantLogoSrc);
  }
};

const applyEmailLayout = (rawHtml: string, primaryColor: string): string => {
  const $ = loadHtml(rawHtml);

  const outerTable = $("body > table").first();
  if (outerTable.length === 0) return rawHtml;

  const wrapperTd = outerTable.find("tbody > tr > td").first();
  if (wrapperTd.length === 0) return rawHtml;

  const cardTable = wrapperTd.children("table").first();
  if (cardTable.length === 0) return rawHtml;

  const cardInnerTd = cardTable
    .children("tbody")
    .first()
    .children("tr")
    .first()
    .children("td")
    .first();
  if (cardInnerTd.length === 0) return rawHtml;

  const nodes = cardInnerTd.children().toArray();
  if (nodes.length === 0) return rawHtml;

  const topCount = Math.ceil(nodes.length / 2);
  const topBlocksHtml = nodes
    .slice(0, topCount)
    .map((n) => $.html(n))
    .join("");
  const bottomBlocksHtml = nodes
    .slice(topCount)
    .map((n) => $.html(n))
    .join("");

  const hasBottom = bottomBlocksHtml.length > 0;

  const topCornerRadius = hasBottom
    ? `${CARD_BORDER_RADIUS_PX}px ${CARD_BORDER_RADIUS_PX}px 0 0`
    : `${CARD_BORDER_RADIUS_PX}px`;
  const bottomCornerRadius = `0 0 ${CARD_BORDER_RADIUS_PX}px ${CARD_BORDER_RADIUS_PX}px`;

  const buildCard = (borderRadius: string, tdPadding: string, blocksHtml: string) =>
    `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" ` +
    `style="max-width:${CARD_MAX_WIDTH_PX}px;width:100%;margin-left:auto;margin-right:auto;background-color:${CARD_BACKGROUND};border-radius:${borderRadius}">` +
    `<tbody><tr><td style="padding:${tdPadding}">${blocksHtml}</td></tr></tbody>` +
    `</table>`;

  const topCardHtml = buildCard(
    topCornerRadius,
    `${CARD_PADDING_TOP_PX}px ${CARD_PADDING_X_PX}px ${
      hasBottom ? 0 : CARD_PADDING_BOTTOM_PX
    }px ${CARD_PADDING_X_PX}px`,
    topBlocksHtml,
  );

  const bottomCardHtml = hasBottom
    ? buildCard(
        bottomCornerRadius,
        `0 ${CARD_PADDING_X_PX}px ${CARD_PADDING_BOTTOM_PX}px ${CARD_PADDING_X_PX}px`,
        bottomBlocksHtml,
      )
    : "";

  const topSectionHtml =
    `<div style="background-color:${primaryColor};padding-top:${HEADER_PADDING_TOP_PX}px${
      hasBottom ? "" : `;padding-bottom:${HEADER_PADDING_TOP_PX}px`
    }">` + `${topCardHtml}</div>`;

  const bottomSectionHtml = hasBottom
    ? `<div style="background-color:${BODY_BACKGROUND};padding-bottom:${HEADER_PADDING_TOP_PX}px">` +
      `${bottomCardHtml}</div>`
    : "";

  const wrapperHtml =
    `<div style="background-color:${BODY_BACKGROUND};width:100%">` +
    `${topSectionHtml}${bottomSectionHtml}` +
    `</div>`;

  $("body").removeAttr("style");
  outerTable.replaceWith(wrapperHtml);

  return $.html();
};
