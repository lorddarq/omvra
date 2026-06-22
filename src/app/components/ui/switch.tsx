"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-4 w-8 shrink-0 items-center rounded-2xl border border-transparent bg-[#d4d4d8] p-0.5 outline-none data-[state=checked]:bg-[#15c349] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-3 w-4 rounded-lg bg-[#fcfcfc] shadow-[0_0_5px_rgba(0,0,0,0.02),0_2px_10px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.30)] ring-0 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
