"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

// Shared class strings (keeps components small + consistent)
const itemClass =
  "border-b";

const triggerClass =
  "group flex flex-1 items-center justify-between gap-3 py-4 text-left text-sm font-medium " +
  "transition-colors hover:opacity-90 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const iconClass =
  "h-4 w-4 shrink-0 transition-transform duration-200 " +
  // ✅ modern Tailwind (preferred)
  "group-data-[state=open]:rotate-180";

// If your Tailwind setup DOESN’T support group-data variants, swap iconClass above with this:
// const iconClass = "h-4 w-4 shrink-0 transition-transform duration-200 group-[&[data-state=open]]:rotate-180";

const contentClass =
  "overflow-hidden text-sm text-muted-foreground " +
  "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down";

const contentInnerClass =
  "pb-4 pt-0";

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(itemClass, className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(triggerClass, className)}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown className={iconClass} />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(contentClass, className)}
    {...props}
  >
    <div className={cn(contentInnerClass)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";
