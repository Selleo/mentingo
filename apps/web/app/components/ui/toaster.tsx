import { Loader2 } from "lucide-react";
import { match } from "ts-pattern";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "~/components/ui/toast";
import { useToast } from "~/components/ui/use-toast";


import { Icon } from "../Icon";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
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
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
