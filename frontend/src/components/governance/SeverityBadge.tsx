import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  baixa: "bg-emerald-500/15 text-emerald-400",
  media: "bg-amber-500/15 text-amber-400",
  alta: "bg-orange-500/15 text-orange-400",
  critica: "bg-red-500/15 text-red-400",
};

export function SeverityBadge({ value }: { value?: string | null }) {
  const v = (value || "media").toLowerCase();
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", MAP[v] || MAP.media)}>
      {v}
    </span>
  );
}
