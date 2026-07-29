import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { ApiClient } from "~/api/api-client";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";
import type { ListTemplatesResponse } from "~/api/generated-api";

const VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g;

function extractVariablesFromBlocks(blocks: EmailTemplateBlocks): string[] {
  const variables = new Set<string>();

  const walk = (node: EmailTemplateBlocks) => {
    if (typeof node.text === "string") {
      VARIABLE_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = VARIABLE_REGEX.exec(node.text)) !== null) {
        variables.add(match[1].trim());
      }
    }

    if (node.attrs) {
      for (const value of Object.values(node.attrs)) {
        if (typeof value === "string") {
          VARIABLE_REGEX.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = VARIABLE_REGEX.exec(value)) !== null) {
            variables.add(match[1].trim());
          }
        }
      }
    }

    if (node.content) {
      for (const child of node.content) {
        walk(child as EmailTemplateBlocks);
      }
    }
  };

  walk(blocks);
  return [...variables].sort();
}

function extractVariablesFromStrings(strings: EmailTemplateStrings): string[] {
  const variables = new Set<string>();

  for (const langStrings of Object.values(strings)) {
    if (!langStrings) continue;
    for (const fragments of Object.values(langStrings)) {
      if (!Array.isArray(fragments)) continue;
      for (const node of fragments) {
        const nodeVars = extractVariablesFromBlocks(node as EmailTemplateBlocks);
        for (const v of nodeVars) variables.add(v);
      }
    }
  }

  return [...variables].sort();
}

function extractVariablesFromSubject(subject: Record<string, string | undefined>): string[] {
  const variables = new Set<string>();

  for (const value of Object.values(subject)) {
    if (typeof value !== "string") continue;
    VARIABLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = VARIABLE_REGEX.exec(value)) !== null) {
      variables.add(match[1].trim());
    }
  }

  return [...variables].sort();
}

export interface AutomationEmailTemplateOption {
  id: string;
  name: string;
  placeholders: string[];
  isCustom: true;
}

export function useEmailTemplatesForAutomation(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ["email-templates-for-automation", { status: "published" }],
    queryFn: async () => {
      const { data } = await ApiClient.api.emailNotificationTemplatesControllerListTemplates({
        status: "published",
        perPage: 100,
      });
      return data;
    },
    select: (data: ListTemplatesResponse) => data.data,
    staleTime: 30_000,
    enabled,
  });

  const templates: AutomationEmailTemplateOption[] = useMemo(() => {
    if (!data) return [];

    return data.map((template) => {
      const blockVars = extractVariablesFromBlocks(template.blocks as EmailTemplateBlocks);
      const stringVars = extractVariablesFromStrings(template.strings as EmailTemplateStrings);
      const subjectVars = extractVariablesFromSubject(
        template.subject as Record<string, string | undefined>,
      );

      const allVars = [...new Set([...blockVars, ...stringVars, ...subjectVars])].sort();

      return {
        id: template.id,
        name: template.name,
        placeholders: allVars,
        isCustom: true as const,
      };
    });
  }, [data]);

  return { templates, isLoading };
}
