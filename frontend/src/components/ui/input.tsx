import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-9 w-full rounded-xl bg-transparent px-3 py-2 text-sm border border-border/60 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40 focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export { Input };
