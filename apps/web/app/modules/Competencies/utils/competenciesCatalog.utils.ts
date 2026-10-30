import { BookOpen, Eye, FileText } from "lucide-react";

import type { CompetencyCondition } from "../competencies.types";
import type { LucideIcon } from "lucide-react";

export const CONDITION_KIND_ICONS: Record<CompetencyCondition["kind"], LucideIcon> = {
  course: BookOpen,
  observation: Eye,
  document: FileText,
};

export const UNCATEGORIZED_FILTER = "none";

export const tableHeadClassName = "details-md text-neutral-800";
