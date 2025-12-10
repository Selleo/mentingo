import { ChevronDown } from "lucide-react";

import { AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";

import type { SupportedLanguages } from "@repo/shared";

interface Props {
  title: string;
  description: string;
  value?: string;
  availableLocales: SupportedLanguages[];
}

export default function QAItem({ title, description, value }: Props) {
  return (
    <AccordionItem value={value ?? title} className="border-b border-border rounded-none">
      <AccordionTrigger className="group w-full px-6 p-5 text-left text-base font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-0">
        <div className="flex w-full items-center text-slate-900">
          <span className="text-primary font-semibold">Q:</span>
          <span className="flex-1">&nbsp;{title}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 text-base pb-4 leading-relaxed text-slate-700">
        <div className="flex gap-2">
          <span className="text-primary font-semibold">A:</span>
          <p className="flex-1">{description}</p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
