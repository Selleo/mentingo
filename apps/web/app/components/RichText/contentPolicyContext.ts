import { createContext, useContext } from "react";

export const RichTextContentPolicyContext = createContext<((html: string) => string) | null>(null);
export const RichTextMediaUrlsContext = createContext<ReadonlySet<string> | null>(null);

export const useRichTextContentPolicy = () => useContext(RichTextContentPolicyContext);

export const useRichTextMediaUrl = (url: string | null | undefined): string | undefined => {
  const allowedUrls = useContext(RichTextMediaUrlsContext);
  if (!url || (allowedUrls && !allowedUrls.has(url))) return undefined;
  return url;
};
