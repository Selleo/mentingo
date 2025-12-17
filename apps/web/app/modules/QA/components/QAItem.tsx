import { useNavigate } from "@remix-run/react";
import { ChevronDown, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

import useDeleteQA from "~/api/mutations/admin/useDeleteQA";
import { Icon } from "~/components/Icon";
import { AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { courseLanguages } from "~/modules/Admin/EditCourse/compontents/CourseLanguageSelector";
import DeleteQADialog from "~/modules/QA/components/DeleteQADialog";

import type { SupportedLanguages } from "@repo/shared";
import type React from "react";

interface Props {
  title: string | null;
  description: string | null;
  id: string;
  availableLocales?: SupportedLanguages[];
  isAdmin?: boolean;
}

export default function QAItem({ title, description, isAdmin, id, availableLocales }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutateAsync: deleteQA, isPending: isDeleting } = useDeleteQA();

  const handleEdit = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    navigate(`/qa/${id}`);
  };

  const onDelete = async () => {
    await deleteQA(id);
  };

  return (
    <AccordionItem value={id} className="border-b border-border rounded-none">
      <AccordionTrigger className="group w-full px-6 p-5 text-left text-base font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-0">
        <div className="flex w-full items-center text-slate-900">
          <span className="text-primary font-semibold">Q:</span>
          <span className="flex-1">&nbsp;{title}</span>
          {isAdmin && (
            <Button
              onClick={handleEdit}
              size="icon"
              variant="ghost"
              onKeyDown={(e) => e.key === "Enter" && handleEdit(e)}
              className="flex size-8 text-slate-500"
              aria-label={t("qaView.aria.editQuestion")}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {isAdmin && <DeleteQADialog onConfirm={onDelete} loading={isDeleting} />}

          <Badge variant="default" className="flex gap-2 ml-1 mr-3">
            {courseLanguages
              .filter((item) => availableLocales?.includes(item.key))
              .map((item) => (
                <Icon key={item.key} name={item.iconName} className="size-4" />
              ))}
          </Badge>
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
