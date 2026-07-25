import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-active text-white hover:bg-[#0fb3a5] hover:shadow-[var(--shadow-glow-teal)]",
        secondary:
          "bg-surface text-text-dim border border-border hover:bg-surface-hover hover:text-text hover:border-text-muted",
        ghost: "text-text-dim hover:bg-surface hover:text-text",
        danger:
          "bg-danger-dim text-danger border border-danger/20 hover:bg-danger/20",
      },
      size: {
        default: "px-4 py-[9px] text-[0.85rem]",
        sm: "px-3 py-1.5 text-[0.8rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
