import { useRef } from "react";

import type { EmailTemplateBlock } from "./emailTemplates.types";

export function useEmailTemplateBlockIds() {
  const blockIdsRef = useRef(new WeakMap<EmailTemplateBlock, string>());
  const nextBlockIdRef = useRef(0);

  const getBlockId = (block: EmailTemplateBlock) => {
    let id = blockIdsRef.current.get(block);
    if (!id) {
      id = `email-block-${nextBlockIdRef.current++}`;
      blockIdsRef.current.set(block, id);
    }
    return id;
  };

  const preserveBlockId = (previous: EmailTemplateBlock, updated: EmailTemplateBlock) => {
    blockIdsRef.current.set(updated, getBlockId(previous));
  };

  return { getBlockId, preserveBlockId };
}
