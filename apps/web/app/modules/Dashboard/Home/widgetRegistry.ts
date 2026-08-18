import { DASHBOARD_WIDGET_TYPES } from "@repo/shared";
import {
  Award,
  BookOpen,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  ListTodo,
  TrendingUp,
} from "lucide-react";

import { AiMentor } from "~/assets/svgs/lesson-types";

import { WidgetAdminDeadlineRisks } from "./widgets/admin-deadline-risks";
import { WidgetAdminTrainingCompletion } from "./widgets/admin-training-completion";
import { WidgetEventCalendar } from "./widgets/event-calendar";
import { WidgetStudentAiMentorPractice } from "./widgets/student-ai-mentor-practice";
import { WidgetStudentCertificates } from "./widgets/student-certificates";
import { WidgetStudentContinueLearning } from "./widgets/student-continue-learning";
import { WidgetStudentCourseCompletion } from "./widgets/student-course-completion";
import { WidgetStudentRequiredCourse } from "./widgets/student-required-course";
import { WidgetTodoTasks } from "./widgets/todo-tasks";

import type { DashboardWidgetModule } from "./types";
import type { DashboardWidgetType } from "@repo/shared";

export const TODO_TASKS_WIDGET_ID = DASHBOARD_WIDGET_TYPES.TODO_LIST;

export type DashboardWidgetRegistry = Record<DashboardWidgetType, DashboardWidgetModule>;

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistry = {
  [DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION]: {
    titleKey: "dashboardHome.widgets.training_completion.title",
    descriptionKey: "dashboardHome.widgets.training_completion.description",
    icon: TrendingUp,
    iconClassName: "text-primary-700",
    component: WidgetAdminTrainingCompletion,
  },
  [DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS]: {
    titleKey: "dashboardHome.widgets.deadline_risks.title",
    descriptionKey: "dashboardHome.widgets.deadline_risks.description",
    icon: CircleAlert,
    iconClassName: "text-primary-700",
    component: WidgetAdminDeadlineRisks,
  },
  [DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR]: {
    titleKey: "dashboardHome.widgets.event_calendar.title",
    descriptionKey: "dashboardHome.widgets.event_calendar.description",
    icon: CalendarDays,
    iconClassName: "text-primary-700",
    component: WidgetEventCalendar,
  },
  [DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING]: {
    titleKey: "dashboardHome.widgets.continue_learning.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.continueLearning.description",
    icon: BookOpen,
    iconClassName: "text-primary-700",
    component: WidgetStudentContinueLearning,
  },
  [DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES]: {
    titleKey: "dashboardHome.widgets.required_course.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.requiredCourse.description",
    icon: GraduationCap,
    iconClassName: "text-primary-700",
    component: WidgetStudentRequiredCourse,
  },
  [DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION]: {
    titleKey: "dashboardHome.widgets.course_completion.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.courseCompletion.description",
    icon: ClipboardCheck,
    iconClassName: "text-primary-700",
    component: WidgetStudentCourseCompletion,
  },
  [DASHBOARD_WIDGET_TYPES.CERTIFICATES]: {
    titleKey: "dashboardHome.widgets.certificates.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.certificates.description",
    icon: Award,
    iconClassName: "text-primary-700",
    component: WidgetStudentCertificates,
  },
  [DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE]: {
    titleKey: "dashboardHome.widgets.ai_mentor_practice.title",
    descriptionKey: "dashboardHome.widgets.studentTiles.aiMentorPractice.description",
    icon: AiMentor,
    iconClassName: "text-primary-700",
    component: WidgetStudentAiMentorPractice,
  },
  [TODO_TASKS_WIDGET_ID]: {
    titleKey: "dashboardHome.widgets.todoTasks.title",
    descriptionKey: "dashboardHome.widgets.todoTasks.description",
    icon: ListTodo,
    component: WidgetTodoTasks,
  },
};
