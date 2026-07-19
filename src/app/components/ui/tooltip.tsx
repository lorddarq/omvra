"use client";

import * as React from "react";

import { cn } from "./utils";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";

interface TooltipContextValue {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const context = React.useContext(TooltipContext);
  if (!context) {
    throw new Error("Tooltip components must be used within <Tooltip>");
  }
  return context;
}

function TooltipProvider({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

function Tooltip({ children }: React.PropsWithChildren) {
  const [open, setOpen] = React.useState(false);
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = React.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const setTooltipOpen = React.useCallback((nextOpen: boolean) => {
    clearOpenTimer();
    if (nextOpen) {
      openTimerRef.current = setTimeout(() => {
        setOpen(true);
        openTimerRef.current = null;
      }, 800);
    } else {
      setOpen(false);
    }
  }, [clearOpenTimer]);

  React.useEffect(() => clearOpenTimer, [clearOpenTimer]);

  return (
    <TooltipProvider>
      <TooltipContext.Provider value={{ open, setOpen: setTooltipOpen }}>
        <span data-slot="tooltip" className="relative inline-flex">
          {children}
        </span>
      </TooltipContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useTooltipContext();
  const child = children as React.ReactElement<any> | undefined;

  const triggerProps = {
    "data-slot": "tooltip-trigger",
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    ...props,
  };

  if (asChild && React.isValidElement(child)) {
    return React.cloneElement(child, {
      ...triggerProps,
      ...child.props,
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        triggerProps.onMouseEnter?.(event as never);
        child.props.onMouseEnter?.(event);
      },
      onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
        triggerProps.onMouseLeave?.(event as never);
        child.props.onMouseLeave?.(event);
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        triggerProps.onFocus?.(event as never);
        child.props.onFocus?.(event);
      },
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        triggerProps.onBlur?.(event as never);
        child.props.onBlur?.(event);
      },
    });
  }

  return <button type="button" {...triggerProps}>{children}</button>;
}

function TooltipContent({
  className,
  side = "top",
  align = "center",
  sideOffset = 0,
  hidden,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
}) {
  const { open } = useTooltipContext();

  if (!open || hidden) return null;

  const sideClassName = {
    top: "bottom-full",
    right: "left-full",
    bottom: "top-full",
    left: "right-full",
  }[side];

  const alignClassName = side === "top" || side === "bottom"
    ? {
        start: "left-0",
        center: "left-1/2 -translate-x-1/2",
        end: "right-0",
      }[align]
    : {
        start: "top-0",
        center: "top-1/2 -translate-y-1/2",
        end: "bottom-0",
      }[align];

  return (
    <div
      data-slot="tooltip-content"
      role="tooltip"
      className={cn(
        "absolute z-50 flex w-fit max-w-[300px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-[#303038] px-3 py-2 text-xs leading-4 text-white shadow-lg",
        sideClassName,
        alignClassName,
        className,
      )}
      style={{
        marginTop: side === "bottom" ? 8 + sideOffset : undefined,
        marginBottom: side === "top" ? 8 + sideOffset : undefined,
        marginLeft: side === "right" ? 8 + sideOffset : undefined,
        marginRight: side === "left" ? 8 + sideOffset : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
