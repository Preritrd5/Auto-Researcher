import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-[#0c5847] shadow-glow",
  secondary: "bg-white/70 text-ink hover:bg-white border border-border/80 shadow-sm",
  outline: "border border-border bg-transparent text-ink hover:bg-white/60 hover:border-accent/40",
  ghost: "bg-transparent text-muted hover:bg-white/60 hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#8a3425] shadow-sm"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base font-semibold",
  icon: "h-9 w-9 p-0 rounded-xl"
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
