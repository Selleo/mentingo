import type { EmailTemplateInlineNode } from "../template-registry.types";

/** Resolve tokens across formatting boundaries, retaining the opening node's marks. */
export function resolveInlineVariables(
  nodes: readonly EmailTemplateInlineNode[],
  replaceVariables: (text: string) => string,
): EmailTemplateInlineNode[] {
  const text = nodes.map((node) => node.text).join("");
  const tokens = [...text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)];
  let offset = 0;

  return nodes.map((node) => {
    const start = offset;
    const end = start + node.text.length;
    offset = end;
    let cursor = start;
    let resolved = "";

    for (const token of tokens) {
      const tokenStart = token.index!;
      const tokenEnd = tokenStart + token[0].length;
      if (tokenEnd <= start || tokenStart >= end) continue;
      resolved += text.slice(cursor, Math.max(cursor, tokenStart));
      if (tokenStart >= start) resolved += replaceVariables(token[0]);
      cursor = Math.min(end, tokenEnd);
    }
    resolved += text.slice(cursor, end);
    return { ...node, text: resolved };
  });
}
