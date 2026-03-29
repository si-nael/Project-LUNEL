import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide border-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary/10 text-primary",
                secondary:
                    "bg-secondary text-secondary-foreground",
                destructive:
                    "bg-destructive/10 text-destructive",
                outline: "border border-border/60 text-foreground/70",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
