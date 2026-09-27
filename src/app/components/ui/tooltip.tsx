"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "./utils";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";

interface TooltipContextValue {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const context = React.useContext(TooltipContext);
  if (!context) {
    throw new Error("Tooltip components must be used within <Tooltip>");
  }
  return context;
}

const TooltipDelayContext = React.createContext(800);

function TooltipProvider({ children, delayDuration = 800 }: React.PropsWithChildren<{ delayDuration?: number }>) {
  return <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>;
}

function Tooltip({ children }: React.PropsWithChildren) {
  const [open, setOpen] = React.useState(false);
  const delayDuration = React.useContext(TooltipDelayContext);
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);

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
      }, delayDuration);
    } else {
      setOpen(false);
    }
  }, [clearOpenTimer, delayDuration]);

  React.useEffect(() => clearOpenTimer, [clearOpenTimer]);

  return (
    <TooltipContext.Provider value={{ open, setOpen: setTooltipOpen, anchorRef }}>
      <span ref={anchorRef} data-slot="tooltip" className="relative inline-flex">
        {children}
      </span>
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({
  children,
  asChild,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useTooltipContext();
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type="button"
      data-slot="tooltip-trigger"
      {...props}
      onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) setOpen(true); }}
      onMouseLeave={event => { onMouseLeave?.(event); setOpen(false); }}
      onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) setOpen(true); }}
      onBlur={event => { onBlur?.(event); setOpen(false); }}
    >
      {children}
    </Component>
  );
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
  const { open, anchorRef } = useTooltipContext();
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [viewportShift, setViewportShift] = React.useState({ x: 0, y: 0 });
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Rendered in a portal with fixed positioning so scroll containers
  // (overflow: auto/hidden) and sibling stacking contexts cannot clip it.
  React.useLayoutEffect(() => {
    if (!open || hidden) return;
    const update = () => {
      if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, hidden, anchorRef]);

  // Keep the tooltip inside the viewport when the anchor sits near an edge.
  React.useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const margin = 8;
    const rect = node.getBoundingClientRect();
    const baseLeft = rect.left - viewportShift.x;
    const baseTop = rect.top - viewportShift.y;
    const clamp = (start: number, size: number, limit: number) =>
      Math.min(Math.max(margin - start, 0), Math.max(limit - margin - (start + size), margin - start));
    const next = {
      x: clamp(baseLeft, rect.width, window.innerWidth),
      y: clamp(baseTop, rect.height, window.innerHeight),
    };
    if (next.x !== viewportShift.x || next.y !== viewportShift.y) setViewportShift(next);
  }, [anchorRect, viewportShift]);

  if (!open || hidden || !anchorRect || typeof document === "undefined") return null;

  const gap = 8 + sideOffset;
  const style: React.CSSProperties = {};
  const transforms: string[] = [];

  if (side === "top" || side === "bottom") {
    if (side === "bottom") {
      style.top = anchorRect.bottom + gap;
    } else {
      style.top = anchorRect.top - gap;
      transforms.push("translateY(-100%)");
    }
    if (align === "start") {
      style.left = anchorRect.left;
    } else if (align === "end") {
      style.left = anchorRect.right;
      transforms.push("translateX(-100%)");
    } else {
      style.left = anchorRect.left + anchorRect.width / 2;
      transforms.push("translateX(-50%)");
    }
  } else {
    if (side === "right") {
      style.left = anchorRect.right + gap;
    } else {
      style.left = anchorRect.left - gap;
      transforms.push("translateX(-100%)");
    }
    if (align === "start") {
      style.top = anchorRect.top;
    } else if (align === "end") {
      style.top = anchorRect.bottom;
      transforms.push("translateY(-100%)");
    } else {
      style.top = anchorRect.top + anchorRect.height / 2;
      transforms.push("translateY(-50%)");
    }
  }
  if (viewportShift.x || viewportShift.y) transforms.push(`translate(${viewportShift.x}px, ${viewportShift.y}px)`);
  if (transforms.length) style.transform = transforms.join(" ");

  return createPortal(
    <div
      ref={contentRef}
      data-slot="tooltip-content"
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-[1000] flex w-fit max-w-[300px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-[#303038] px-3 py-2 text-xs leading-4 text-white shadow-lg",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
