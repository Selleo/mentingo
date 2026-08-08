import { InlineDiagnosticNote } from "./InlineDiagnosticNote";

import type { EmailTemplateDiagnostic, SupportedLanguages } from "@repo/shared";

type InlineDiagnosticStackProps = {
  diagnostics: EmailTemplateDiagnostic[];
};

type InlineDiagnosticDisplayItem = {
  diagnostic: EmailTemplateDiagnostic;
  languages?: SupportedLanguages[];
};

const makeDiagnosticGroupKey = (diagnostic: EmailTemplateDiagnostic): string =>
  [
    diagnostic.severity,
    diagnostic.reason,
    diagnostic.nodeUuid ?? "",
    diagnostic.nodeType ?? "",
    diagnostic.detail ?? "",
  ].join(":");

export const groupInlineDiagnostics = (
  diagnostics: EmailTemplateDiagnostic[],
): InlineDiagnosticDisplayItem[] => {
  const items: InlineDiagnosticDisplayItem[] = [];
  const byKey = new Map<string, InlineDiagnosticDisplayItem>();

  for (const diagnostic of diagnostics) {
    if (!diagnostic.language) {
      items.push({ diagnostic });
      continue;
    }

    const key = makeDiagnosticGroupKey(diagnostic);
    const existing = byKey.get(key);
    if (!existing) {
      const item: InlineDiagnosticDisplayItem = {
        diagnostic,
        languages: [diagnostic.language],
      };
      byKey.set(key, item);
      items.push(item);
      continue;
    }
    if (!existing.languages?.includes(diagnostic.language)) {
      existing.languages = [...(existing.languages ?? []), diagnostic.language];
    }
  }

  return items;
};

export const InlineDiagnosticStack = ({ diagnostics }: InlineDiagnosticStackProps) => {
  if (diagnostics.length === 0) return null;
  const items = groupInlineDiagnostics(diagnostics);

  return (
    <div className="space-y-1">
      {items.map(({ diagnostic, languages }, index) => (
        <InlineDiagnosticNote
          key={`${diagnostic.reason}:${diagnostic.language ?? ""}:${index}`}
          diagnostic={diagnostic}
          languages={languages}
        />
      ))}
    </div>
  );
};
