import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  completed: "bg-[#dff3e8] text-success",
  running: "bg-[#dff0ec] text-accent",
  queued: "bg-[#eceae4] text-muted",
  failed: "bg-[#f7e0db] text-danger",
  stopped: "bg-[#eceae4] text-muted",
  pending: "bg-[#ede7d8] text-warning",
  active: "bg-[#dff3e8] text-success"
};

export function Badge({
  label,
  tone
}: {
  label: string;
  tone?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        toneMap[tone || label.toLowerCase()] || "bg-white/70 text-muted"
      )}
    >
      {label}
    </span>
  );
}

