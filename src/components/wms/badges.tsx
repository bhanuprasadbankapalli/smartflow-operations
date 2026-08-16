import { cn } from "@/lib/utils";
import type {
  InventoryStatus,
  OrderStatus,
  PackingStatus,
  PickingStatus,
  Priority,
  Severity,
  ShipmentStatus,
} from "@/lib/wms/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning-foreground border-warning/40",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
  accent: "bg-accent/15 text-accent-foreground border-accent/40",
};

export function Pill({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const ORDER_TONE: Record<OrderStatus, Tone> = {
  NEW: "neutral",
  PRIORITIZED: "info",
  ALLOCATED: "info",
  PICKING: "info",
  PACKING: "warning",
  QUALITY_CHECK: "warning",
  READY_FOR_DISPATCH: "accent",
  DISPATCHED: "success",
  COMPLETED: "success",
  BACKORDER: "warning",
  EXCEPTION: "danger",
  CANCELLED: "neutral",
};

export const label = (s: string) => s.replaceAll("_", " ");

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Pill tone={ORDER_TONE[status]} dot>
    {label(status)}
  </Pill>
);

const PRIORITY_TONE: Record<Priority, Tone> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  NORMAL: "neutral",
};

export const PriorityBadge = ({ priority, score }: { priority: Priority; score?: number }) => (
  <Pill tone={PRIORITY_TONE[priority]}>
    {priority}
    {typeof score === "number" && <span className="tabular font-normal opacity-70">{score}</span>}
  </Pill>
);

const SEVERITY_TONE: Record<Severity, Tone> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "neutral",
};

export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <Pill tone={SEVERITY_TONE[severity]}>{severity}</Pill>
);

const INV_TONE: Record<InventoryStatus, Tone> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
  RESERVED: "info",
  DAMAGED: "accent",
};

export const InventoryBadge = ({ status }: { status: InventoryStatus }) => (
  <Pill tone={INV_TONE[status]} dot>
    {label(status)}
  </Pill>
);

const TASK_TONE: Record<PickingStatus | PackingStatus | ShipmentStatus, Tone> = {
  ASSIGNED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  MISSING: "danger",
  DAMAGED: "danger",
  WAITING: "neutral",
  BLOCKED: "danger",
  READY: "accent",
  DISPATCHED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
};

export const TaskStatusBadge = ({ status }: { status: PickingStatus | PackingStatus | ShipmentStatus }) => (
  <Pill tone={TASK_TONE[status]} dot>
    {label(status)}
  </Pill>
);
