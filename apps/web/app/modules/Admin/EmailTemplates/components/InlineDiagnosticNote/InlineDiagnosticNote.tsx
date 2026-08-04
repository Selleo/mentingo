import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { EmailTemplateDiagnostic, SupportedLanguages } from "@repo/shared";

type InlineDiagnosticNoteProps = {
  diagnostic: EmailTemplateDiagnostic;
  languages?: SupportedLanguages[];
};

export const InlineDiagnosticNote = ({ diagnostic, languages }: InlineDiagnosticNoteProps) => {
  const { t } = useTranslation();
  const isError = diagnostic.severity === "error";
  const languageTags = languages ?? (diagnostic.language ? [diagnostic.language] : []);

  return (
    <div
      className={cn("rounded-md border px-2 py-1 text-xs", {
        "border-red-200 bg-red-50 text-red-900": isError,
        "border-yellow-200 bg-yellow-50 text-yellow-900": !isError,
      })}
    >
      <span className="font-medium">
        {t(`emailTemplates.publishDiagnostics.reasons.${diagnostic.reason}`)}
      </span>
      {diagnostic.detail && (
        <span
          className={cn("ml-1", {
            "text-red-800": isError,
            "text-yellow-800": !isError,
          })}
        >
          {diagnostic.detail}
        </span>
      )}
      {languageTags.length > 0 && (
        <span className="ml-1.5 inline-flex flex-wrap gap-0.5 align-middle">
          {languageTags.map((language) => (
            <span
              key={language}
              className={cn(
                "inline-flex rounded border px-1 py-0.5 text-[10px] font-semibold leading-none",
                {
                  "border-red-200 bg-red-100 text-red-900": isError,
                  "border-yellow-200 bg-yellow-100 text-yellow-900": !isError,
                },
              )}
            >
              [{language.toUpperCase()}]
            </span>
          ))}
        </span>
      )}
    </div>
  );
};
