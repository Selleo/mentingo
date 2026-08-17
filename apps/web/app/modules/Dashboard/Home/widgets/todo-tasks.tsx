import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateTodoTask } from "~/api/mutations/useCreateTodoTask";
import { useDeleteTodoTask } from "~/api/mutations/useDeleteTodoTask";
import { useReorderTodoTasks } from "~/api/mutations/useReorderTodoTasks";
import { useUpdateTodoTask } from "~/api/mutations/useUpdateTodoTask";
import { useTodoTasks, type TodoTask } from "~/api/queries/useTodoTasks";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY, TODO_TASKS_WIDGET_ID } from "../widgetRegistry";

import type { DashboardWidgetSize } from "../types";

type SortableTaskProps = {
  task: TodoTask;
  compact: boolean;
  onToggle: () => void;
  onSave: (title: string) => void;
  onDelete: () => void;
};

function SortableTask({ task, compact, onToggle, onSave, onDelete }: SortableTaskProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    data: { completed: task.completed },
  });

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  const saveTitle = () => {
    const nextTitle = title.trim();
    setIsEditingTitle(false);
    if (nextTitle && nextTitle !== task.title) {
      onSave(nextTitle);
    }
  };

  return (
    // This boundary prevents task drag/edit gestures from activating the parent widget drag surface.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={setNodeRef}
      role="group"
      aria-label={task.title}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-neutral-100",
        compact ? "px-2 py-1" : "px-2.5 py-2",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2",
          task.completed
            ? "border-primary-700 bg-primary-700 text-white"
            : "border-neutral-300 text-transparent hover:border-primary-500",
        )}
        aria-label={t("dashboardHome.widgets.todoTasks.toggle", { title: task.title })}
      >
        <Check className="size-3" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="cursor-grab touch-none text-neutral-400 hover:text-neutral-700 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
        {...attributes}
        {...listeners}
        aria-label={t("dashboardHome.widgets.todoTasks.reorder")}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      {isEditingTitle ? (
        <Input
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setTitle(task.title);
              setIsEditingTitle(false);
            }
          }}
          className="h-7 min-w-0 flex-1 text-sm"
          maxLength={200}
        />
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            task.completed && "text-neutral-400 line-through",
          )}
        >
          {task.title}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setIsEditingTitle(true)}
          aria-label={t("dashboardHome.widgets.todoTasks.edit")}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-error-600 hover:text-error-700"
          onClick={onDelete}
          aria-label={t("dashboardHome.widgets.todoTasks.delete")}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function WidgetTodoTasks({ widgetSize = "2x2" }: { widgetSize?: DashboardWidgetSize }) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading, isError, refetch } = useTodoTasks(true);
  const { mutateAsync: createTask, isPending: isCreating } = useCreateTodoTask();
  const { mutateAsync: updateTask } = useUpdateTodoTask();
  const { mutateAsync: deleteTask } = useDeleteTodoTask();
  const { mutateAsync: reorderTasks } = useReorderTodoTasks();
  const [newTask, setNewTask] = useState("");
  const metadata = DASHBOARD_WIDGET_REGISTRY[TODO_TASKS_WIDGET_ID];
  const isCompact = widgetSize === "2x1";
  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  const sectionCollisionDetection = (args: Parameters<typeof closestCenter>[0]) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.completed === args.active.data.current?.completed,
      ),
    });

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;

    const source = tasks.find((task) => task.id === String(event.active.id));
    const target = tasks.find((task) => task.id === String(event.over?.id));
    if (!source || !target || source.completed !== target.completed) return;

    const section = source.completed ? completedTasks : activeTasks;
    const ids = section.map((task) => task.id);
    const from = ids.indexOf(String(event.active.id));
    const to = ids.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);

    void reorderTasks({
      activeTaskIds: source.completed ? activeTasks.map((task) => task.id) : next,
      completedTaskIds: source.completed ? next : completedTasks.map((task) => task.id),
    });
  };

  const addTask = async () => {
    const title = newTask.trim();
    if (!title || isCreating) return;

    await createTask(title);
    setNewTask("");
  };

  const renderTask = (task: TodoTask) => (
    <SortableTask
      key={task.id}
      task={task}
      compact={isCompact}
      onToggle={() => void updateTask({ id: task.id, completed: !task.completed })}
      onSave={(title) => void updateTask({ id: task.id, title })}
      onDelete={() => void deleteTask(task.id)}
    />
  );

  return (
    <DashboardWidgetCard>
      <DashboardWidgetHeader
        title={t(metadata?.titleKey ?? "dashboardHome.widgets.todoTasks.title")}
        icon={metadata?.icon ?? ListTodo}
      />
      <DashboardWidgetContent
        className={cn("flex flex-col", isCompact ? "gap-1 p-2" : "gap-3 p-3")}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading || isError ? (
            <DashboardWidgetQueryState
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
            />
          ) : tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-neutral-500">
              {t("dashboardHome.widgets.todoTasks.empty")}
            </p>
          ) : (
            <DndContext collisionDetection={sectionCollisionDetection} onDragEnd={handleDragEnd}>
              <SortableContext
                items={tasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={isCompact ? "space-y-1" : "space-y-2"}>
                  {activeTasks.map(renderTask)}
                  {completedTasks.map(renderTask)}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <form
          className={cn(
            "flex items-center border-t border-neutral-100",
            isCompact ? "gap-1 pt-1" : "gap-2 pt-3",
          )}
          onSubmit={(event) => {
            event.preventDefault();
            void addTask();
          }}
        >
          <Input
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            maxLength={200}
            placeholder={t("dashboardHome.widgets.todoTasks.placeholder")}
            className={cn("min-w-0", isCompact ? "h-7" : "h-9")}
          />
          <Button
            type="submit"
            size="icon"
            className={cn("shrink-0", isCompact ? "size-7" : "size-9")}
            disabled={!newTask.trim() || isCreating}
            aria-label={t("dashboardHome.widgets.todoTasks.add")}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </form>
      </DashboardWidgetContent>
    </DashboardWidgetCard>
  );
}
