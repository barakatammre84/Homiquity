import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => (
  <div className="relative">
    <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      $
    </span>
    <Input ref={ref} inputMode="decimal" placeholder="0.00" className={cn("pl-7", className)} {...props} />
  </div>
));
MoneyInput.displayName = "MoneyInput";
