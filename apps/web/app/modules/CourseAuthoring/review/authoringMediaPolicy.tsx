import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  RichTextContentPolicyContext,
  RichTextMediaUrlsContext,
} from "~/components/RichText/contentPolicyContext";

import type { AuthoringMediaPolicy } from "./authoringMediaPolicy.types";
import type { ReactNode } from "react";

const FETCH_ATTRIBUTES = new Set([
  "src",
  "data-src",
  "srcset",
  "data-srcset",
  "poster",
  "data-poster",
  "background",
]);
const isFetchAttribute = (element: Element, name: string) =>
  FETCH_ATTRIBUTES.has(name) ||
  (name === "href" && (element.hasAttribute("data-node-type") || element.tagName === "LINK"));
const RESOURCE_ATTRIBUTES = new Set(["data-resource-id", "data-resource-entity-id"]);

const inertContent = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
};

export const buildAuthoringMediaPolicy = (
  trustedHtml: readonly string[],
  previewUrls: Readonly<Record<string, string>> = {},
  trustedUrls: readonly string[] = [],
  trustedResourceIds: readonly string[] = [],
): AuthoringMediaPolicy => {
  const urls = new Set([...Object.values(previewUrls), ...trustedUrls]);
  const resourceIds = new Set(trustedResourceIds);
  if (typeof document !== "undefined") {
    for (const html of trustedHtml) {
      for (const element of inertContent(html).content.querySelectorAll("*")) {
        for (const attribute of element.attributes) {
          if (isFetchAttribute(element, attribute.name) && attribute.value)
            urls.add(attribute.value);
          if (RESOURCE_ATTRIBUTES.has(attribute.name) && attribute.value)
            resourceIds.add(attribute.value);
        }
      }
    }
  }
  return { urls, resourceIds };
};

export const restrictAuthoringMedia = (
  html: string,
  policy: AuthoringMediaPolicy,
  placeholder: string,
): string => {
  if (typeof document === "undefined") return "";
  const template = inertContent(html);
  for (const element of template.content.querySelectorAll("*")) {
    let blocked = false;
    for (const attribute of [...element.attributes]) {
      if (attribute.name === "style") element.removeAttribute(attribute.name);
      if (
        isFetchAttribute(element, attribute.name) &&
        attribute.value &&
        !policy.urls.has(attribute.value)
      )
        blocked = true;
      if (
        RESOURCE_ATTRIBUTES.has(attribute.name) &&
        attribute.value &&
        !policy.resourceIds.has(attribute.value)
      )
        blocked = true;
    }
    if (blocked) {
      const replacement = document.createElement("p");
      const label = element.getAttribute("alt") ?? element.getAttribute("data-alt");
      replacement.textContent = label ? `${label} — ${placeholder}` : placeholder;
      element.replaceWith(replacement);
    }
  }
  return template.innerHTML;
};

export const AuthoringMediaPolicyProvider = ({
  trustedHtml,
  assetPreviewUrls,
  trustedUrls = [],
  trustedResourceIds = [],
  children,
}: {
  trustedHtml: readonly string[];
  assetPreviewUrls?: Readonly<Record<string, string>>;
  children: ReactNode;
  trustedUrls?: readonly string[];
  trustedResourceIds?: readonly string[];
}) => {
  const { t } = useTranslation();
  const policy = useMemo(
    () => buildAuthoringMediaPolicy(trustedHtml, assetPreviewUrls, trustedUrls, trustedResourceIds),
    [trustedHtml, assetPreviewUrls, trustedUrls, trustedResourceIds],
  );
  const filter = useCallback(
    (html: string) =>
      restrictAuthoringMedia(html, policy, t("courseAuthoring.review.mediaPreviewBlocked")),
    [policy, t],
  );
  return (
    <RichTextMediaUrlsContext.Provider value={policy.urls}>
      <RichTextContentPolicyContext.Provider value={filter}>
        {children}
      </RichTextContentPolicyContext.Provider>
    </RichTextMediaUrlsContext.Provider>
  );
};
