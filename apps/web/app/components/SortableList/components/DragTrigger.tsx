import { useContext } from "react";

import { SortableItemContext } from "~/components/SortableList/components/sortableItemContext";

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type DragTriggerProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export const DragTrigger = ({
  children,
  className,
  type = "button",
  ...props
}: DragTriggerProps) => {
  const { attributes, listeners, ref } = useContext(SortableItemContext);

  return (
    <button {...attributes} {...listeners} ref={ref} type={type} className={className} {...props}>
      {children}
    </button>
  );
};
