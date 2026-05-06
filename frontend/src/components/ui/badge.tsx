import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-sm shadow-primary-500/20 hover:from-primary-700 hover:to-primary-600",
        secondary:
          "border-transparent bg-primary-50 text-primary-900 border border-primary-100 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-100 dark:border-primary-800",
        destructive:
          "border-transparent bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm shadow-red-500/20 hover:from-red-700 hover:to-red-600",
        outline: "text-foreground",
        success:
          "border-transparent bg-success text-success-foreground shadow-sm shadow-success/20 hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground shadow-sm shadow-warning/20 hover:bg-warning/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
