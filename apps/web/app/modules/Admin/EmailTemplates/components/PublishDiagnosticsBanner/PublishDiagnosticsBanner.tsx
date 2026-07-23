import { AlertTriangle, XCircle } from "lucide-react";
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { EmailTemplateBlocks, EmailTemplateDiagnostic } from "@repo/shared";
import type { TFunction } from "i18next";

type PublishDiagnosticsBannerProps = {
  diagnostics: EmailTemplateDiagnostic[];
  blocks?: EmailTemplateBlocks;
};

const buildNodePositions = (blocks: EmailTemplateBlocks | undefined): Map<string, number> => {
  const positions = new Map<string, number>();
  if (!blocks) return positions;
  let counter = 0;
  const walk = (node: EmailTemplateBlocks) => {
    const uuid = node.attrs?.uuid;
    if (typeof uuid === "string") {
      counter += 1;
      positions.set(uuid, counter);
    }
    node.content?.forEach(walk);
  };
  walk(blocks);
  return positions;
};

const describeDiagnostic = (
  diagnostic: EmailTemplateDiagnostic,
  t: TFunction,
  positions: Map<string, number>,
): string => {
  const parts: string[] = [];
  parts.push(t(`emailTemplates.publishDiagnostics.reasons.${diagnostic.reason}`));
  if (diagnostic.severity === "warning" && diagnostic.language) {
    parts.push(`[${diagnostic.language.toUpperCase()}]`);
  }
  const position = diagnostic.nodeUuid ? positions.get(diagnostic.nodeUuid) : undefined;
  if (position !== undefined) {
    parts.push(t("emailTemplates.publishDiagnostics.elementIndex", { index: position }));
  }
  if (diagnostic.nodeType) {
    const key = `emailTemplates.publishDiagnostics.nodeTypes.${diagnostic.nodeType}`;
    const label = t(key);
    parts.push(label === key ? diagnostic.nodeType : label);
  }
  if (diagnostic.detail) parts.push(diagnostic.detail);
  return parts.join(" · ");
};

const DiagnosticsList = ({
  items,
  t,
  positions,
}: {
  items: EmailTemplateDiagnostic[];
  t: TFunction;
  positions: Map<string, number>;
}) => {
  const sorted = useMemo(
    () => items.slice().sort((a, b) => (a.language ?? "").localeCompare(b.language ?? "")),
    [items],
  );
  return (
    <ul className="ml-1 space-y-1 text-sm">
      {sorted.map((diagnostic, index, list) => {
        const isLanguageBoundary =
          index > 0 && (list[index - 1].language ?? "") !== (diagnostic.language ?? "");
        return (
          <Fragment key={index}>
            {isLanguageBoundary && (
              <li aria-hidden="true">
                <hr className="my-3 border-t border-gray-100" />
              </li>
            )}
            <li className="font-mono text-xs">{describeDiagnostic(diagnostic, t, positions)}</li>
          </Fragment>
        );
      })}
    </ul>
  );
};

export const PublishDiagnosticsBanner = ({
  diagnostics,
  blocks,
}: PublishDiagnosticsBannerProps) => {
  const { t } = useTranslation();
  const positions = useMemo(() => buildNodePositions(blocks), [blocks]);

  const { errors, warnings } = useMemo(() => {
    const errors: EmailTemplateDiagnostic[] = [];
    const warnings: EmailTemplateDiagnostic[] = [];
    for (const d of diagnostics) {
      if (d.severity === "error") errors.push(d);
      else warnings.push(d);
    }
    return { errors, warnings };
  }, [diagnostics]);

  if (diagnostics.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {errors.length > 0 && (
        <div className="rounded-md border bg-white p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-error-600">
            <XCircle className="size-4" />
            {t("emailTemplates.publishDiagnostics.errorsTitle", { count: errors.length })}
          </div>
          <DiagnosticsList items={errors} t={t} positions={positions} />
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border bg-white p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-warning-600">
            <AlertTriangle className="size-4" />
            {t("emailTemplates.publishDiagnostics.warningsTitle", { count: warnings.length })}
          </div>
          <DiagnosticsList items={warnings} t={t} positions={positions} />
        </div>
      )}
    </div>
  );
};
