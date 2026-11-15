import React, { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  completed: "bg-[#dff3e8] text-success border-success/20",
  running: "bg-[#dff0ec] text-accent border-accent/20",
  queued: "bg-[#eceae4] text-muted border-border",
  failed: "bg-[#f7e0db] text-danger border-danger/20",
  stopped: "bg-[#eceae4] text-muted border-border",
  pending: "bg-[#ede7d8] text-warning border-warning/20",
  active: "bg-[#dff3e8] text-success border-success/20",
  success: "bg-[#dff3e8] text-success border-success/20",
  accent: "bg-[#dff0ec] text-accent border-accent/20",
  warning: "bg-[#ede7d8] text-warning border-warning/20",
  danger: "bg-[#f7e0db] text-danger border-danger/20",
  neutral: "bg-white/70 text-muted border-border/80"
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
  tone?: string;
  variant?: "solid" | "outline" | "subtle";
  dot?: boolean;
}

export function Badge({
  label,
  tone,
  variant = "subtle",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const content = label || children;
  const key = (tone || (typeof content === "string" ? content.toLowerCase() : "")).toLowerCase();
  const colorClass = toneMap[key] || "bg-white/70 text-muted border-border/80";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
        colorClass,
        className
      )}
      {...props}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      ) : null}
      {content}
    </span>
  );
}
