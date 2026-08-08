import { EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";

import type { EmailTemplateBlocks, EmailTemplateNode, EmailTemplateStrings } from "@repo/shared";

const collectUuids = (node: EmailTemplateNode, into: Set<string>): void => {
  const raw = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
  if (typeof raw === "string" && raw.length > 0) into.add(raw);
  if (node.content) {
    for (const child of node.content) collectUuids(child, into);
  }
};

export const pruneOrphanStrings = (
  blocks: EmailTemplateBlocks,
  strings: EmailTemplateStrings,
): EmailTemplateStrings => {
  const liveUuids = new Set<string>();
  collectUuids(blocks, liveUuids);

  const pruned: EmailTemplateStrings = {};
  for (const [language, byUuid] of Object.entries(strings)) {
    if (!byUuid) continue;
    const kept: Record<string, EmailTemplateNode[]> = {};
    for (const [uuid, fragment] of Object.entries(byUuid)) {
      if (liveUuids.has(uuid)) kept[uuid] = fragment;
    }
    if (Object.keys(kept).length > 0) {
      pruned[language as keyof EmailTemplateStrings] = kept;
    }
  }
  return pruned;
};
