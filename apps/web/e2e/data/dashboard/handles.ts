export const DASHBOARD_WIDGET_HANDLES = {
  EVENT_CALENDAR: "dashboard-widget-event-calendar",
  ADMIN_TRAINING_COMPLETION: "dashboard-widget-admin-training-completion",
  ADMIN_DEADLINE_RISKS: "dashboard-widget-admin-deadline-risks",
  STUDENT_CONTINUE_LEARNING: "dashboard-widget-student-continue-learning",
  STUDENT_REQUIRED_COURSE: "dashboard-widget-student-required-course",
  STUDENT_COURSE_COMPLETION: "dashboard-widget-student-course-completion",
  STUDENT_CERTIFICATES: "dashboard-widget-student-certificates",
  STUDENT_GAMIFICATION: "dashboard-widget-student-gamification",
  TODO_TASKS: "dashboard-widget-todo-tasks",
  /** Grid cell around every rendered widget, in layout order. */
  SLOT: "dashboard-widget-slot",
  EMPTY_STATE: "dashboard-widget-empty-state",
  ERROR_STATE: "dashboard-widget-error-state",
  RETRY: "dashboard-widget-retry",
  CHART: "dashboard-widget-chart",
} as const;

export const DASHBOARD_EDIT_HANDLES = {
  CUSTOMIZE: "dashboard-customize",
  OPEN_WIDGET_PICKER: "dashboard-open-widget-picker",
  FINISH_EDITING: "dashboard-finish-editing",
  WIDGET_PICKER_CLOSE: "dashboard-widget-picker-close",
  RESTORE_DEFAULT: "dashboard-restore-default",
  RESTORE_DEFAULT_DIALOG: "dashboard-restore-default-dialog",
  RESTORE_DEFAULT_CONFIRM: "dashboard-restore-default-confirm",
  RESTORE_DEFAULT_CANCEL: "dashboard-restore-default-cancel",
  widgetToggle: (type: string) => `dashboard-widget-toggle-${type}`,
  dragHandle: (type: string) => `dashboard-widget-drag-${type}`,
  sizeTrigger: (type: string) => `dashboard-widget-size-${type}`,
  sizeOption: (size: string) => `dashboard-widget-size-option-${size}`,
} as const;

export const DASHBOARD_CALENDAR_HANDLES = {
  OPEN_CALENDAR: "dashboard-calendar-open-page",
} as const;

export const DASHBOARD_DEADLINE_RISK_HANDLES = {
  SORT_TRIGGER: "dashboard-deadline-risks-sort",
  sortOption: (order: string) => `dashboard-deadline-risks-sort-${order}`,
  COURSE_LIST: "dashboard-deadline-risks-course-list",
  course: (id: string) => `dashboard-deadline-risks-course-${id}`,
  DIALOG: "dashboard-deadline-risks-dialog",
  SEARCH: "dashboard-deadline-risks-search",
  STATUS_FILTER: "dashboard-deadline-risks-status-filter",
  statusOption: (status: string) => `dashboard-deadline-risks-status-${status}`,
  GROUP_LIST: "dashboard-deadline-risks-group-list",
  groupSort: (field: string) => `dashboard-deadline-risks-group-sort-${field}`,
  group: (id: string) => `dashboard-deadline-risks-group-${id}`,
  learner: (id: string) => `dashboard-deadline-risks-learner-${id}`,
} as const;

export const DASHBOARD_TODO_HANDLES = {
  NEW_TASK_INPUT: "dashboard-todo-new-task-input",
  ADD_TASK: "dashboard-todo-add-task",
  TASK: "dashboard-todo-task",
  TASK_TITLE: "dashboard-todo-task-title",
  TASK_TITLE_INPUT: "dashboard-todo-task-title-input",
  TASK_TOGGLE: "dashboard-todo-task-toggle",
  TASK_REORDER: "dashboard-todo-task-reorder",
  TASK_EDIT: "dashboard-todo-task-edit",
  TASK_DELETE: "dashboard-todo-task-delete",
} as const;

export const DASHBOARD_STUDENT_HANDLES = {
  continueCourse: (courseId: string) => `dashboard-continue-learning-course-${courseId}`,
  CONTINUE_NEXT_LESSON: "dashboard-continue-learning-next-lesson",
  requiredCourse: (courseId: string) => `dashboard-required-course-${courseId}`,
  requiredCourseUrgency: (urgency: string) => `dashboard-required-course-urgency-${urgency}`,
  REQUIRED_COURSES_TOTAL: "dashboard-required-courses-total",
  REQUIRED_COURSES_OVERDUE: "dashboard-required-courses-overdue",
  CERTIFICATE_LIST: "dashboard-certificates-list",
  certificate: (id: string) => `dashboard-certificate-${id}`,
} as const;

export const DASHBOARD_REPORT_HANDLES = {
  DOWNLOAD: "dashboard-report-download",
} as const;
