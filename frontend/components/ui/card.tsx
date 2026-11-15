import React, { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[28px] border border-border/80 bg-surface/90 p-5 shadow-panel transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export interface LegacyCardTitleProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

export function CardTitle({
  eyebrow,
  title,
  description,
  className,
  children,
  ...props
}: LegacyCardTitleProps & HTMLAttributes<HTMLHeadingElement>) {
  if (title || eyebrow || description) {
    return (
      <div className="mb-4">
        {eyebrow ? (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-3">
          <h2 className={cn("font-serif text-2xl font-bold tracking-tight text-ink", className)}>
            {title}
          </h2>
        </div>
        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
        {children}
      </div>
    );
  }

  return (
    <h3
      className={cn("font-serif text-xl font-bold tracking-tight text-ink", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pt-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 flex items-center pt-2", className)} {...props}>
      {children}
    </div>
  );
}
