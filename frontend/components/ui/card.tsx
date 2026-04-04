import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[28px] border border-border/80 bg-surface/90 p-5 shadow-panel",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      {eyebrow ? (
        <div className="mb-1 text-xs font-medium uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
      </div>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
    </div>
  );
}
