import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent",
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent",
        props.className
      )}
    />
  );
}
