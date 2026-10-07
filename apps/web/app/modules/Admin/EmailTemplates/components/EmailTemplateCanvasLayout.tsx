import { getEmailCardBackground } from "@repo/shared";

import type { ReactNode } from "react";

export function EmailTemplateCanvasLayout({
  primaryColor,
  headerContent,
  decoration,
  children,
}: {
  primaryColor: string;
  headerContent: ReactNode;
  decoration: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ backgroundImage: getEmailCardBackground(primaryColor) }}>
      <div className="relative mx-auto w-[90%] max-w-[500px] rounded-3xl bg-white pt-8 pb-[50px]">
        {headerContent}
        {children}
        <div
          className="pointer-events-none absolute bottom-0 left-0 overflow-hidden rounded-bl-3xl"
          aria-hidden="true"
        >
          {decoration}
        </div>
      </div>
    </div>
  );
}
