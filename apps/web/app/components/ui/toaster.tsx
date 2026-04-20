import { Loader2 } from "lucide-react";
import { match } from "ts-pattern";

import { RichTextUploadQueue } from "~/components/RichText/RichTextUploadQueue";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "~/components/ui/toast";
import { useToast } from "~/components/ui/use-toast";
import { useRichTextUploadQueue } from "~/hooks/useRichTextUploadQueue";

import { TOAST_HANDLES } from "../../../e2e/data/common/handles";
import { Icon } from "../Icon";

export function Toaster() {
  const { toasts } = useToast();
  const { items, clearFinished, remove } = useRichTextUploadQueue();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} data-testid={TOAST_HANDLES.ROOT} {...props}>
            <div className="flex items-center gap-1">
              {match(props.variant)
                .with("success", () => (
                  <Icon
                    name="InputRoundedMarkerSuccess"
                    className="mr-2 size-4 text-green-500 shrink-0"
                  />
                ))
                .with("loading", () => (
                  <Loader2 className="mr-2 size-4 animate-spin text-blue-500 shrink-0" />
                ))
                .otherwise(() => null)}
              <div className="flex flex-col">
                {title && <ToastTitle data-testid={TOAST_HANDLES.TITLE}>{title}</ToastTitle>}
                {description && (
                  <ToastDescription data-testid={TOAST_HANDLES.DESCRIPTION}>
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport
        data-testid={TOAST_HANDLES.VIEWPORT}
        queueSlot={
          <RichTextUploadQueue
            items={items}
            onClearFinished={clearFinished}
            onRemoveItem={remove}
          />
        }
      />
    </ToastProvider>
  );
}
