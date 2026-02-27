import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";

type CourseGenerationAiTypingMessageProps = {
  aiLabel: string;
  thinkingLabel?: string | null;
};

export function CourseGenerationAiTypingMessage({
  aiLabel,
  thinkingLabel,
}: CourseGenerationAiTypingMessageProps) {
  return (
    <div className="flex max-w-full gap-3">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full">
        <Avatar className="size-full flex items-center justify-center bg-primary-100">
          <AvatarFallback>
            <Icon name="AiMentor" className="p-1 text-primary-600" />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="min-w-0 max-w-[90%] flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary-900">{aiLabel}</span>
          {thinkingLabel && (
            <Badge
              variant="secondary"
              className="inline-flex h-5 items-center rounded-full px-2 py-1 text-[10px]"
            >
              {thinkingLabel}
            </Badge>
          )}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary-50 px-4 py-3">
          <span className="size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500 [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500 [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500" />
        </div>
      </div>
    </div>
  );
}
