import { Link } from "@remix-run/react";
import { Fragment, createElement, type ReactNode } from "react";

import { cn } from "~/lib/utils";

const ALLOWED_FORMATTING_TAGS = new Set([
  "strong",
  "b",
  "em",
  "i",
  "u",
  "p",
  "br",
  "ul",
  "ol",
  "li",
]);
const ALLOWED_TAGS = new Set([...ALLOWED_FORMATTING_TAGS, "a"]);
const VOID_TAGS = new Set(["br"]);
const HTML_TOKEN_PATTERN = /<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/gu;
const HREF_ATTRIBUTE_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

type SafeAnnouncementContentProps = {
  html: string;
  className?: string;
};

type ParsedNode = {
  tag: string;
  href?: string;
  children: Array<ParsedNode | string>;
};

export function SafeAnnouncementContent({ html, className }: SafeAnnouncementContentProps) {
  const nodes = parseSafeHtml(html);

  return (
    <div className={cn("line-clamp-2 text-sm leading-5 text-neutral-700", className)}>
      {renderNodes(nodes)}
    </div>
  );
}

function parseSafeHtml(html: string) {
  const root: ParsedNode = { tag: "root", children: [] };
  const stack: ParsedNode[] = [root];
  let lastIndex = 0;

  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    if (match.index > lastIndex) {
      addText(stack, html.slice(lastIndex, match.index));
    }

    lastIndex = match.index + match[0].length;

    if (match[3]) {
      addText(stack, match[3]);
      continue;
    }

    const rawTag = match[1]?.toLowerCase();
    if (!rawTag || !ALLOWED_TAGS.has(rawTag)) continue;

    const isClosingTag = match[0].startsWith("</");
    if (isClosingTag) {
      closeTag(stack, rawTag);
      continue;
    }

    const node: ParsedNode = {
      tag: rawTag,
      children: [],
      href: rawTag === "a" ? getSafeHref(match[2] ?? "") : undefined,
    };

    stack[stack.length - 1].children.push(node);

    if (!VOID_TAGS.has(rawTag) && !match[0].endsWith("/>")) {
      stack.push(node);
    }
  }

  if (lastIndex < html.length) {
    addText(stack, html.slice(lastIndex));
  }

  return root.children;
}

function addText(stack: ParsedNode[], text: string) {
  stack[stack.length - 1].children.push(decodeHtmlEntities(text));
}

function closeTag(stack: ParsedNode[], tag: string) {
  if (stack.length > 1 && stack[stack.length - 1].tag === tag) {
    stack.pop();
  }
}

function getSafeHref(rawAttributes: string) {
  const rawHref = HREF_ATTRIBUTE_PATTERN.exec(rawAttributes)?.slice(1).find(Boolean);
  if (!rawHref) return undefined;

  const href = decodeHtmlEntities(rawHref).trim();

  if (href.startsWith("/") && !href.startsWith("//")) return href;

  try {
    const url = new URL(href);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return undefined;
  }

  return undefined;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/gu, (entity, codePoint: string) =>
      decodeCodePoint(entity, Number(codePoint)),
    )
    .replace(/&#x([\da-f]+);/giu, (entity, codePoint: string) =>
      decodeCodePoint(entity, Number.parseInt(codePoint, 16)),
    )
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&apos;/gu, "'");
}

function decodeCodePoint(entity: string, codePoint: number) {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return entity;
  }
}

function renderNodes(nodes: Array<ParsedNode | string>): ReactNode {
  return nodes.map((node, index) => {
    if (typeof node === "string") {
      return <Fragment key={index}>{node}</Fragment>;
    }

    const children = renderNodes(node.children);

    if (node.tag === "a") {
      if (!node.href) return <Fragment key={index}>{children}</Fragment>;

      if (node.href.startsWith("/")) {
        return (
          <Link
            key={index}
            to={node.href}
            className="font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            {children}
          </Link>
        );
      }

      return (
        <a
          key={index}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    }

    if (node.tag === "br") return <br key={index} />;

    return createElement(node.tag, { key: index }, children);
  });
}
