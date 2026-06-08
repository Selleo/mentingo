import { load as loadHtml } from "cheerio";
import { sql, type SQL } from "drizzle-orm";

import { tryParseJsonString } from "src/utils/jsonb";

import type { Element } from "domhandler";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

type SqlExpression<T> = SQL<T> | AnyPgColumn;

export const getNullIfEmpty = <T>(expr: SqlExpression<T>) => sql<T | null>`NULLIF(${expr}, '')`;

export const getJsonbTextValue = (jsonbField: SqlExpression<unknown>, key: string) =>
  sql<string | null>`${jsonbField}->>${key}`;

export const getPathBasename = (reference: SqlExpression<string>) =>
  sql<string>`regexp_replace(${reference}, '^.*/', '')`;

export const getMetadataTextValue = (metadata: AnyPgColumn, key: string) =>
  getNullIfEmpty(getJsonbTextValue(metadata, key));

export const getAssetDisplayFileName = (params: {
  localizedTitle: SQL<string>;
  originalFilename: SQL<string | null>;
  reference: SqlExpression<string>;
}) =>
  sql<string>`COALESCE(
    ${getNullIfEmpty(params.localizedTitle)},
    ${params.originalFilename},
    ${getPathBasename(params.reference)}
  )`;

const RESOURCE_URL_ID_ATTRIBUTE_SELECTORS = ["href", "src", "data-src"] as const;
const RESOURCE_ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const RESOURCE_URL_ID_PATTERN =
  /(?:lesson-resource|articles-resource|news-resource)\/([0-9a-fA-F-]{36})(?:[^0-9a-fA-F-]|$)/g;
const RESOURCE_URL_ID_REPLACE_PATTERN =
  /((?:(?:https?:\/\/[^/\s"'<>]+)?\/api\/(?:lesson|articles|news)\/)?(lesson-resource|articles-resource|news-resource)\/)([0-9a-fA-F-]{36})(?=[^0-9a-fA-F-]|$)/g;
const RESOURCE_ID_ATTRIBUTE_REPLACE_PATTERN = /(data-resource-id=["'])([0-9a-fA-F-]{36})(["'])/g;
const RESOURCE_ROUTE_API_PATHS = {
  "lesson-resource": "/api/lesson/lesson-resource",
  "articles-resource": "/api/articles/articles-resource",
  "news-resource": "/api/news/news-resource",
} as const;

type ResourceRoute = keyof typeof RESOURCE_ROUTE_API_PATHS;

export const buildRelativeResourceUrl = (resourceId: string, route: ResourceRoute) =>
  `${RESOURCE_ROUTE_API_PATHS[route]}/${resourceId}`;

export const buildTenantResourceUrl = (
  tenantHost: string,
  resourceId: string,
  route: ResourceRoute,
) => `${tenantHost.replace(/\/+$/, "")}${buildRelativeResourceUrl(resourceId, route)}`;

const getResourceIdUrlPattern = (resourceId: string) =>
  new RegExp(
    `(?:lesson-resource|articles-resource|news-resource)/${resourceId.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )}(?:[^0-9a-fA-F-]|$)`,
  );

export const contentReferencesResource = (content: string, resourceId: string) =>
  content.includes(resourceId) || content.includes(`data-resource-id="${resourceId}"`);

export const extractResourceIdsFromRichText = (content: string) => {
  const resourceIds = new Set<string>();
  const $ = loadHtml(content);

  $("[data-resource-id]").each((_, element) => {
    const resourceId = $(element).attr("data-resource-id");

    if (resourceId && RESOURCE_ID_PATTERN.test(resourceId)) resourceIds.add(resourceId);
  });

  RESOURCE_URL_ID_ATTRIBUTE_SELECTORS.forEach((attribute) => {
    $(`[${attribute}]`).each((_, element) => {
      const value = $(element).attr(attribute);
      if (!value) return;

      for (const match of value.matchAll(RESOURCE_URL_ID_PATTERN)) {
        if (match[1]) resourceIds.add(match[1]);
      }
    });
  });

  for (const match of content.matchAll(RESOURCE_URL_ID_PATTERN)) {
    if (match[1]) resourceIds.add(match[1]);
  }

  return [...resourceIds];
};

export const removeResourceReferencesFromRichText = (
  content: string,
  resourceId: string,
): { content: string; hasChanged: boolean } => {
  if (!contentReferencesResource(content, resourceId)) return { content, hasChanged: false };

  const $ = loadHtml(content);
  const resourceUrlPattern = getResourceIdUrlPattern(resourceId);

  let hasChanged = false;

  const removeElement = (element: Element) => {
    $(element).remove();
    hasChanged = true;
  };

  $(`[data-resource-id="${resourceId}"]`).each((_, element) => removeElement(element));

  RESOURCE_URL_ID_ATTRIBUTE_SELECTORS.forEach((attribute) => {
    $(`[${attribute}]`).each((_, element) => {
      const value = $(element).attr(attribute);

      if (value && resourceUrlPattern.test(value)) removeElement(element);
    });
  });

  if (!hasChanged) return { content, hasChanged: false };

  const bodyChildren = $("body").children();

  return {
    content: $.html(bodyChildren.length ? bodyChildren : $.root().children()),
    hasChanged,
  };
};

export const replaceResourceReferencesInRichText = (
  content: string,
  resourceIdMap: Map<string, string>,
  options: {
    buildResourceUrl?: (resourceId: string, route: ResourceRoute) => string;
  } = {},
) => {
  if (!resourceIdMap.size) return content;

  const replaceResourceId = (resourceId: string) => resourceIdMap.get(resourceId) ?? resourceId;

  return content
    .replace(
      RESOURCE_URL_ID_REPLACE_PATTERN,
      (_match, prefix: string, route: ResourceRoute, resourceId: string) => {
        const nextResourceId = replaceResourceId(resourceId);

        return options.buildResourceUrl?.(nextResourceId, route) ?? `${prefix}${nextResourceId}`;
      },
    )
    .replace(
      RESOURCE_ID_ATTRIBUTE_REPLACE_PATTERN,
      (_match, prefix: string, resourceId: string, suffix: string) =>
        `${prefix}${replaceResourceId(resourceId)}${suffix}`,
    );
};

export const getLocalizedRichTextEntries = (localizedContent: unknown): [string, string][] => {
  if (!localizedContent || typeof localizedContent !== "object" || Array.isArray(localizedContent))
    return [];

  return Object.entries(localizedContent).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
};

export const mapLocalizedTextEntries = (value: unknown, mapEntry: (content: string) => string) => {
  const localizedValue = typeof value === "string" ? (tryParseJsonString(value) ?? value) : value;

  if (!localizedValue || typeof localizedValue !== "object" || Array.isArray(localizedValue)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(localizedValue as Record<string, unknown>).map(([language, content]) => [
      language,
      typeof content === "string" ? mapEntry(content) : content,
    ]),
  );
};
