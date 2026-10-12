import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import type * as LabelPrimitive from "@radix-ui/react-label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("flex flex-col gap-y-1.5", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn(
        "text-sm text-muted-foreground",
        "mono:text-xs mono:text-neutral-800",
        className,
      )}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn(
        "details-md flex items-center gap-x-1.5 text-error-600",
        "mono:text-xs mono:text-error-500",
        className,
      )}
      {...props}
    >
      <svg
        width="16"
        height="17"
        viewBox="0 0 16 17"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_2961_63289)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.00794 1.14945C8.90392 0.974856 8.75633 0.83027 8.57963 0.72986C8.40293 0.629451 8.20318 0.57666 7.99994 0.57666C7.79671 0.57666 7.59696 0.629451 7.42026 0.72986C7.24356 0.83027 7.09597 0.974856 6.99194 1.14945L0.171678 12.5927C0.0655645 12.7708 0.00854018 12.9738 0.00640963 13.1811C0.00427908 13.3884 0.0571184 13.5926 0.159549 13.7729C0.261979 13.9531 0.410342 14.103 0.589535 14.2073C0.768728 14.3116 0.972352 14.3665 1.17968 14.3665H14.8202C15.0275 14.3665 15.2312 14.3116 15.4104 14.2073C15.5895 14.103 15.7379 13.9531 15.8403 13.7729C15.9428 13.5926 15.9956 13.3884 15.9935 13.1811C15.9913 12.9738 15.9343 12.7708 15.8282 12.5927L9.00794 1.14945ZM7.90928 1.69559C7.91884 1.68015 7.93219 1.66741 7.94806 1.65858C7.96393 1.64975 7.98178 1.64511 7.99994 1.64511C8.0181 1.64511 8.03596 1.64975 8.05183 1.65858C8.0677 1.66741 8.08105 1.68015 8.09061 1.69559L14.9119 13.1388C14.9215 13.155 14.9267 13.1734 14.9269 13.1923C14.927 13.2111 14.9222 13.2296 14.9129 13.246C14.9036 13.2623 14.8901 13.2759 14.8738 13.2854C14.8575 13.2949 14.839 13.2999 14.8202 13.2999H1.17968C1.16085 13.2999 1.14236 13.2949 1.12608 13.2854C1.10981 13.2759 1.09633 13.2623 1.08701 13.246C1.07769 13.2296 1.07287 13.2111 1.07303 13.1923C1.0732 13.1734 1.07834 13.155 1.08794 13.1388L7.90928 1.69559ZM7.28208 5.28492C7.27676 5.18736 7.29138 5.08973 7.32505 4.99801C7.35873 4.90629 7.41074 4.82239 7.47792 4.75144C7.54511 4.6805 7.62605 4.62399 7.7158 4.58537C7.80555 4.54676 7.90224 4.52684 7.99994 4.52684C8.09765 4.52684 8.19434 4.54676 8.28409 4.58537C8.37384 4.62399 8.45478 4.6805 8.52196 4.75144C8.58915 4.82239 8.64116 4.90629 8.67484 4.99801C8.70851 5.08973 8.72313 5.18736 8.71781 5.28492L8.55461 9.55265C8.54586 9.69354 8.48373 9.82578 8.38087 9.92245C8.27801 10.0191 8.14217 10.0729 8.00101 10.0729C7.85986 10.0729 7.72401 10.0191 7.62115 9.92245C7.51829 9.82578 7.45616 9.69354 7.44741 9.55265L7.28208 5.28492ZM8.79994 11.6743C8.79994 11.8864 8.71566 12.0899 8.56563 12.2399C8.4156 12.39 8.21212 12.4743 7.99994 12.4743C7.78777 12.4743 7.58429 12.39 7.43426 12.2399C7.28423 12.0899 7.19994 11.8864 7.19994 11.6743C7.19994 11.4621 7.28423 11.2586 7.43426 11.1086C7.58429 10.9585 7.78777 10.8743 7.99994 10.8743C8.21212 10.8743 8.4156 10.9585 8.56563 11.1086C8.71566 11.2586 8.79994 11.4621 8.79994 11.6743Z"
            fill="#C41116"
          />
        </g>
        <defs>
          <clipPath id="clip0_2961_63289">
            <rect width="16" height="16" fill="white" transform="translate(0 0.5)" />
          </clipPath>
        </defs>
      </svg>
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
