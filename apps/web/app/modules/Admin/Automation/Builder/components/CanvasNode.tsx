import { useDroppable } from "@dnd-kit/core";
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CircleX,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { useBuilderStore } from "../automationBuilderStore";

import { AddNodePicker } from "./AddNodePicker";

import type { AutomationStepDefinition, BuilderNode } from "../automationBuilder.types";
import type { FC, ReactNode } from "react";

const ICON_MAP: Record<string, ReactNode> = {
  course_deadline: <CalendarClock className="size-4" />,
  overdue: <AlertTriangle className="size-4" />,
  not_completed: <CircleX className="size-4" />,
  user_enrolled: <UserPlus className="size-4" />,
  certificate_expiring_soon: <Award className="size-4" />,
  live_transmission_starting_soon: <Video className="size-4" />,
  send_email: <Mail className="size-4" />,
};

interface CanvasNodeProps {
  node: BuilderNode;
  onAddChild: (parentId: string, definition: AutomationStepDefinition) => void;
}

export const CanvasNode: FC<CanvasNodeProps> = ({ node, onAddChild }) => {
  const { t } = useTranslation();
  const selectNode = useBuilderStore((s) => s.selectNode);
  const removeNode = useBuilderStore((s) => s.removeNode);
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);

  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-node-${node.id}`,
    data: { targetNodeId: node.id },
  });

  const isSelected = selectedNodeId === node.id;
  const childNodes = nodes.filter((n) => node.children.includes(n.id));
  const hasMultipleChildren = childNodes.length > 1;

  return (
    <div className="flex flex-col items-center">
      {/* The node card */}
      <Button
        ref={setNodeRef}
        variant="ghost"
        onClick={() => selectNode(node.id)}
        className={cn(
          "group relative flex h-auto w-56 items-center gap-2 rounded-lg border-2 px-3 py-2.5 shadow-sm transition-all text-left whitespace-normal",
          node.kind === "condition"
            ? "border-blue-200 bg-blue-50 hover:bg-blue-100/60"
            : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60",
          isSelected && "ring-2 ring-primary ring-offset-2",
          isOver && "ring-2 ring-amber-400 ring-offset-1",
        )}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            node.kind === "condition"
              ? "bg-blue-100 text-blue-600"
              : "bg-emerald-100 text-emerald-600",
          )}
        >
          {ICON_MAP[node.type]}
        </span>
        <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            removeNode(node.id);
          }}
          aria-label={t("automationBuilder.canvas.removeNode")}
        >
          <Trash2 className="size-3.5 text-error-500" />
        </Button>
      </Button>

      {/* Vertical connector line down to the "add child" button */}
      <svg width="2" height="16" className="shrink-0">
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="16"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/40"
        />
      </svg>

      {/* Add child picker button */}
      <AddNodePicker
        onSelect={(definition) => onAddChild(node.id, definition)}
        trigger={
          <Button
            variant="outline"
            size="icon"
            className="size-7 rounded-full border-dashed"
            aria-label={t("automationBuilder.canvas.addChild")}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      />

      {/* Children with proper connector lines */}
      {childNodes.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical stem from "+" button down to children area */}
          <svg width="2" height="20" className="shrink-0">
            <line
              x1="1"
              y1="0"
              x2="1"
              y2="20"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/40"
            />
          </svg>

          {hasMultipleChildren ? (
            <div className="flex flex-col items-center">
              {/* Horizontal rail connecting all children branches */}
              <svg
                height="2"
                className="shrink-0"
                style={{ width: `${(childNodes.length - 1) * 240 + 2}px` }}
              >
                <line
                  x1="0"
                  y1="1"
                  x2="100%"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/40"
                />
              </svg>

              {/* Children evenly spaced below the rail */}
              <div className="flex items-start" style={{ gap: "2rem" }}>
                {childNodes.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical drop from rail to child node */}
                    <svg width="2" height="20" className="shrink-0">
                      <line
                        x1="1"
                        y1="0"
                        x2="1"
                        y2="20"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted-foreground/40"
                      />
                    </svg>
                    {/* Arrow indicator */}
                    <svg width="10" height="8" className="shrink-0 -mt-0.5 mb-0.5">
                      <polygon
                        points="5,8 0,0 10,0"
                        fill="currentColor"
                        className="text-muted-foreground/40"
                      />
                    </svg>
                    <CanvasNode node={child} onAddChild={onAddChild} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Single child — straight vertical connector with arrow */
            childNodes.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Arrow indicator */}
                <svg width="10" height="8" className="shrink-0 mb-0.5">
                  <polygon
                    points="5,8 0,0 10,0"
                    fill="currentColor"
                    className="text-muted-foreground/40"
                  />
                </svg>
                <CanvasNode node={child} onAddChild={onAddChild} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
