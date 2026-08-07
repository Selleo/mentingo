import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import {
  Award,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  TrendingUp,
} from "lucide-react";

import { WidgetAdminDeadlineRisks } from "./widgets/admin-deadline-risks";
import { WidgetAdminEventCalendar } from "./widgets/admin-event-calendar";
import { WidgetAdminIncompleteCourses } from "./widgets/admin-incomplete-courses";
import { WidgetAdminTrainingCompletion } from "./widgets/admin-training-completion";
import { WidgetStudentAiMentorPractice } from "./widgets/student-ai-mentor-practice";
import { WidgetStudentCertificates } from "./widgets/student-certificates";
import { WidgetStudentContinueLearning } from "./widgets/student-continue-learning";
import { WidgetStudentCourseCompletion } from "./widgets/student-course-completion";
import { WidgetStudentRequiredCourse } from "./widgets/student-required-course";

import type { DashboardWidgetModule } from "./types";
import type { DashboardWidgetId } from "@repo/shared";

export type DashboardWidgetRegistry = Record<DashboardWidgetId, DashboardWidgetModule>;

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistry = {
  [DASHBOARD_WIDGET_IDS.ADMIN_TRAINING_COMPLETION]: {
    titleKey: "dashboardHome.widgets.training_completion.title",
    descriptionKey: "dashboardHome.widgets.training_completion.description",
    icon: TrendingUp,
    iconClassName: "text-green-700",
    iconContainerClassName: "bg-green-50",
    component: WidgetAdminTrainingCompletion,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_DEADLINE_RISKS]: {
    titleKey: "dashboardHome.widgets.deadline_risks.title",
    descriptionKey: "dashboardHome.widgets.deadline_risks.description",
    icon: CircleAlert,
    iconClassName: "text-yellow-700",
    iconContainerClassName: "bg-yellow-50",
    component: WidgetAdminDeadlineRisks,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_INCOMPLETE_COURSES]: {
    titleKey: "dashboardHome.widgets.incomplete_courses.title",
    descriptionKey: "dashboardHome.widgets.incomplete_courses.description",
    icon: ListChecks,
    iconClassName: "text-purple-700",
    iconContainerClassName: "bg-purple-50",
    component: WidgetAdminIncompleteCourses,
  },
  [DASHBOARD_WIDGET_IDS.ADMIN_EVENT_CALENDAR]: {
    titleKey: "dashboardHome.widgets.event_calendar.title",
    descriptionKey: "dashboardHome.widgets.event_calendar.description",
    icon: CalendarDays,
    iconClassName: "text-blue-700",
    iconContainerClassName: "bg-blue-50",
    component: WidgetAdminEventCalendar,
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
