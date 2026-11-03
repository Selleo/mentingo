import type {
  CompetenciesSummary,
  Competency,
  CompetencyCatalogItem,
  CompetencyCondition,
  CompetencyInput,
  CompetencyProfileItem,
  CompetencyReadiness,
  CompetencyReviewDecision,
  CompetencyReviewItem,
  CompetencySubjectWorkspace,
} from "../competencies.types";
import type { OverviewView } from "../utils/competenciesOverview.utils";
import type { CompetenciesSetupStep } from "../utils/competenciesReadiness.utils";
import type { Capabilities } from "../utils/competenciesWorkspace.utils";
import type { ReactNode } from "react";
import type { PaginationReducerState } from "~/hooks/usePaginationReducer.types";

export type CompetenciesCatalogOptions = {
  onEdit: (value: CompetencyCatalogItem) => void;
  onCreate: () => void;
};

export type CompetenciesDocumentsOptions = {
  workspace: CompetencySubjectWorkspace;
  subjectId: string;
  userId: string;
};

export type CompetenciesOverviewOptions = {
  summary: CompetenciesSummary;
  canManage: boolean;
  onPersonOpen: (id: string) => void;
  onSetupStepStart: (step: CompetenciesSetupStep) => void;
};

export type CompetenciesProfileEditorOptions = {
  profile?: CompetencyProfileItem;
  close: () => void;
};

export type CompetenciesProfilesOptions = {
  onEdit: (profile: CompetencyProfileItem) => void;
  onCreate?: () => void;
};

export type CompetenciesReviewOptions = { onSubject: (id: string) => void };

export type CompetenciesWorkspaceOptions = { capabilities: Capabilities };

export type CompetencyConditionOverrideOptions = {
  workspace: CompetencySubjectWorkspace;
  subjectId: string;
  competency: Competency;
  condition: CompetencyCondition;
};

export type CompetencyEditorOptions = {
  value?: CompetencyInput;
  onSave: (value: CompetencyInput) => Promise<unknown>;
  onClose: () => void;
  pending: boolean;
  onDelete?: () => Promise<unknown>;
};

export type CompetencyEvidenceFormOptions = {
  competency: Competency;
  subjectId: string;
  recognition?: boolean;
  condition?: CompetencyCondition;
  onClose: () => void;
};

export type CompetencySubjectOptions = {
  workspace: CompetencySubjectWorkspace;
  subjectId: string;
  userId: string;
  canManage?: boolean;
  headerAction?: ReactNode;
};

export type CompetencyEvidenceDraft = {
  competency: Competency;
  recognition: boolean;
  condition?: CompetencyCondition;
};

export type CompetencyRevocationDraft = {
  competency: Competency;
  conditions: CompetencyCondition[];
};

export type CompetencyDocumentSubmission = Pick<CompetencyEvidenceDraft, "competency"> & {
  condition: CompetencyCondition;
};

export type CompetencyReviewDecisionDraft = {
  evidence: CompetencyReviewItem;
  status: CompetencyReviewDecision;
  requestId: string;
};

export type CompetenciesOverviewQueryOptions = PaginationReducerState & {
  canManage: boolean;
  view: OverviewView;
  profileFilter: string;
  statusFilter: CompetencyReadiness | null;
};
