import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import {
  Award,
  BookOpen,
  BrainCircuit,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  TrendingUp,
} from "lucide-react";

import { WidgetAdminPlaceholder1 } from "./widgets/admin-placeholder1";
import { WidgetAdminPlaceholder2 } from "./widgets/admin-placeholder2";
import { WidgetAdminPlaceholder3 } from "./widgets/admin-placeholder3";
import { WidgetStudentAiMentorPractice } from "./widgets/student-ai-mentor-practice";
import { WidgetStudentCertificates } from "./widgets/student-certificates";
import { WidgetStudentContinueLearning } from "./widgets/student-continue-learning";
import { WidgetStudentCourseCompletion } from "./widgets/student-course-completion";
import { WidgetStudentRequiredCourse } from "./widgets/student-required-course";

import type { DashboardWidgetModule } from "./types";
import type { DashboardWidgetId } from "@repo/shared";

export type DashboardWidgetRegistry = Record<DashboardWidgetId, DashboardWidgetModule>;

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistry = {
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER1]: {
    titleKey: "dashboardHome.widgets.a_placeholder_1.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: TrendingUp,
    component: WidgetAdminPlaceholder1,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER2]: {
    titleKey: "dashboardHome.widgets.a_placeholder_2.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: CircleAlert,
    component: WidgetAdminPlaceholder2,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_PLACEHOLDER3]: {
    titleKey: "dashboardHome.widgets.a_placeholder_3.title",
    descriptionKey: "dashboardHome.widgets.placeholderDescription",
    icon: ListChecks,
    component: WidgetAdminPlaceholder3,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING]: {
    titleKey: "dashboardHome.widgets.continue_learning.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.continueLearning.description",
    icon: BookOpen,
    iconClassName: "text-blue-700",
    iconContainerClassName: "bg-blue-50",
    component: WidgetStudentContinueLearning,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE]: {
    titleKey: "dashboardHome.widgets.required_course.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.requiredCourse.description",
    icon: GraduationCap,
    iconClassName: "text-yellow-700",
    iconContainerClassName: "bg-yellow-50",
    component: WidgetStudentRequiredCourse,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION]: {
    titleKey: "dashboardHome.widgets.course_completion.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.courseCompletion.description",
    icon: ClipboardCheck,
    iconClassName: "text-green-700",
    iconContainerClassName: "bg-green-50",
    component: WidgetStudentCourseCompletion,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES]: {
    titleKey: "dashboardHome.widgets.certificates.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.certificates.description",
    icon: Award,
    iconClassName: "text-purple-700",
    iconContainerClassName: "bg-purple-50",
    component: WidgetStudentCertificates,
  },
  [DASHBOARD_WIDGET_IDS.STUDENT_AI_MENTOR_PRACTICE]: {
    titleKey: "dashboardHome.widgets.ai_mentor_practice.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.aiMentorPractice.description",
    icon: BrainCircuit,
    iconClassName: "text-primary-700",
    iconContainerClassName: "bg-primary-50",
    component: WidgetStudentAiMentorPractice,
  },
};
