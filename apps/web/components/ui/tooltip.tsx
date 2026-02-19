"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@shared/lib/utils";

/* ---- Context ---- */

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip components must be used within <Tooltip>");
  return ctx;
}

/* ---- Provider (wraps app or section, provides delay settings) ---- */

interface TooltipProviderProps {
  delayDuration?: number;
  children: React.ReactNode;
}

const DelayContext = React.createContext(300);

function TooltipProvider({
  delayDuration = 300,
  children,
}: TooltipProviderProps) {
  return (
    <DelayContext.Provider value={delayDuration}>
      {children}
    </DelayContext.Provider>
  );
}

/* ---- Tooltip (state holder) ---- */

interface TooltipProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Tooltip({ open: controlledOpen, onOpenChange, children }: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </TooltipContext.Provider>
  );
}

/* ---- Trigger ---- */

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => {
  const { setOpen, triggerRef } = useTooltipContext();
  const delay = React.useContext(DelayContext);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => setOpen(true), delay);
  };

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  return (
    <button
      ref={(node) => {
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }}
      type="button"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      {...props}
    >
      {children}
    </button>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

/* ---- Content ---- */

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }
>(({ className, sideOffset = 6, children, ...props }, ref) => {
  const { open, triggerRef } = useTooltipContext();
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - sideOffset + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [open, sideOffset, triggerRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-50 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-fade-in",
        className
      )}
      style={{ top: pos.top, left: pos.left }}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
