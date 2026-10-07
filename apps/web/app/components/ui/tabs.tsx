"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center",
      !IS_MONO_DESIGN && "h-10 justify-center rounded-md bg-primary-50 p-1 text-muted-foreground",
      IS_MONO_DESIGN && "items-stretch gap-4 border-b border-border",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      !IS_MONO_DESIGN &&
        "rounded-sm px-3 py-1.5 text-neutral-900 data-[state=active]:bg-background data-[state=active]:text-primary-800 data-[state=active]:shadow-sm",
      IS_MONO_DESIGN &&
        "-mb-px border-b-2 border-transparent px-1 pb-2 pt-1 text-neutral-700 hover:text-primary-700 data-[state=active]:border-primary-500 data-[state=active]:font-semibold data-[state=active]:text-primary-700",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
