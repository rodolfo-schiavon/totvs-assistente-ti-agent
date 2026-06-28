import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  baixo: "bg-emerald-500/15 text-emerald-400",
  medio: "bg-amber-500/15 text-amber-400",
  alto: "bg-orange-500/15 text-orange-400",
  critico: "bg-red-500/15 text-red-400",
};

export function RiskBadge({ value }: { value?: string | null }) {
  const v = (value || "baixo").toLowerCase();
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", MAP[v] || MAP.baixo)}>
      {v}
    </span>
  );
}
