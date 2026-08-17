import type { LucideIcon } from "lucide-react";
import { Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "success" | "warning" | "danger" | "info" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  danger: "text-danger",
  info: "text-info",
  accent: "text-accent-foreground",
};

const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent/20 text-accent-foreground",
};

const TONE_STROKE: Record<Tone, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  accent: "var(--color-accent)",
};

export function Sparkline({ data, tone = "primary" }: { data: number[]; tone?: Tone }) {
  const series = data.map((v, i) => ({ i, v }));
  const id = `spark-${tone}`;
  return (
    <div className="h-11 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TONE_STROKE[tone]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={TONE_STROKE[tone]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={TONE_STROKE[tone]}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChip({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const flat = delta === 0;
  const good = invert ? delta < 0 : delta > 0;
  const Icon = flat ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
      )}
    >
      <Icon className="size-3" />
      {flat ? "0%" : `${delta > 0 ? "+" : ""}${delta}%`}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  invert,
  hint,
  icon: Icon,
  tone = "primary",
  spark,
  ready = true,
}: {
  label: string;
  value: string | number;
  delta: number;
  invert?: boolean;
  hint: string;
  icon: LucideIcon;
  tone?: Tone;
  spark: number[];
  ready?: boolean;
}) {
  if (!ready) {
    return (
      <div className="glass p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-16" />
        <Skeleton className="mt-4 h-11 w-full" />
      </div>
    );
  }
  return (
    <div className="glass lift group relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <Tooltip>
              <TooltipTrigger aria-label={`About ${label}`} className="text-muted-foreground/60 transition-colors hover:text-foreground">
                <Info className="size-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-xs">{hint}</TooltipContent>
            </Tooltip>
          </div>
          <p className={cn("tabular mt-2 text-3xl font-bold leading-none", TONE_TEXT[tone])}>{value}</p>
          <div className="mt-2 flex items-center gap-2">
            <TrendChip delta={delta} invert={invert ?? false} />
            <span className="text-[11px] text-muted-foreground">vs. prev. shift</span>
          </div>
        </div>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            TONE_SOFT[tone],
          )}
        >
          <Icon className="size-4.5" />
        </span>
      </div>
      <div className="-mx-1 mt-2">
        <Sparkline data={spark} tone={tone} />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-1" style={{ height }}>
      {[45, 70, 35, 88, 60, 78, 52, 92, 40].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
