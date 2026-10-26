import { createContext, useContext, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AssistantSourceLink } from "./AssistantSourceLink";

import type { AssistantSource } from "../assistant.types";

const SourcesContext = createContext<Map<string, AssistantSource>>(new Map());

function VerifiedMarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const source = useContext(SourcesContext).get(href ?? "");
  return source ? (
    <AssistantSourceLink source={source}>{children}</AssistantSourceLink>
  ) : (
    <span>{children}</span>
  );
}

// Stable renderer identities preserve open previews during polling and streaming updates.
const markdownComponents = {
  a: VerifiedMarkdownLink,
  img: ({ alt }: { alt?: string }) => <span>{alt}</span>,
};

/** Untrusted Assistant content never loads images or creates links without verified source metadata. */
export function AssistantMarkdown({
  text,
  sources = [],
}: {
  text: string;
  sources?: readonly AssistantSource[];
}) {
  const verifiedSources = sources.filter((source) => {
    if (source.url.includes("\\") || source.url.startsWith("//")) return false;
    try {
      const url = new URL(source.url, "https://assistant.invalid");
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.pathname.startsWith("//") &&
        (/^https?:\/\//i.test(source.url) || source.url.startsWith("/"))
      );
    } catch {
      return false;
    }
  });
  const sourcesByUrl = new Map(verifiedSources.map((source) => [source.url, source]));
  return (
    <div className="prose prose-sm max-w-none break-words text-sm text-foreground prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-6 prose-a:text-primary-700 dark:prose-a:text-primary-300 prose-pre:overflow-x-auto prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-800 prose-pre:text-foreground">
      <SourcesContext.Provider value={sourcesByUrl}>
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {text}
        </Markdown>
      </SourcesContext.Provider>
    </div>
  );
}
