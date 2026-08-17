import { createFileRoute } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Boxes,
  Cog,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGate } from "@/components/wms/app-shell";
import { Pill } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import type { ActivityLog } from "@/lib/wms/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — SmartFlow WMS" },
      {
        name: "description",
        content: "Full audit trail of warehouse operations: orders, picking, packing, quality, dispatch and exceptions.",
      },
      { property: "og:title", content: "Activity Log — SmartFlow WMS" },
      {
        property: "og:description",
        content: "Chronological audit trail of every automated and manual warehouse action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "dispatcher"]}>
      <ActivityPage />
    </RoleGate>
  ),
});

type Kind = ActivityLog["kind"];

const KIND_META: Record<Kind, { icon: typeof ActivityIcon; tone: "success" | "warning" | "danger" | "info" | "neutral" | "accent"; label: string }> = {
  order: { icon: PackageSearch, tone: "info", label: "Order" },
  inventory: { icon: Warehouse, tone: "accent", label: "Inventory" },
  picking: { icon: Boxes, tone: "info", label: "Picking" },
  packing: { icon: PackageCheck, tone: "warning", label: "Packing" },
  quality: { icon: ShieldCheck, tone: "warning", label: "Quality" },
  dispatch: { icon: Truck, tone: "success", label: "Dispatch" },
  exception: { icon: AlertTriangle, tone: "danger", label: "Exception" },
  system: { icon: Cog, tone: "neutral", label: "System" },
};

const KINDS = Object.keys(KIND_META) as Kind[];

function dayLabel(at: number) {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function ActivityPage() {
  const { state } = useWms();
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [actor, setActor] = useState("all");
  const [q, setQ] = useState("");

  const actors = useMemo(() => [...new Set(state.activity.map((a) => a.actor))].sort(), [state.activity]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...state.activity]
      .sort((a, b) => b.at - a.at)
      .filter((a) => (kind === "all" ? true : a.kind === kind))
      .filter((a) => (actor === "all" ? true : a.actor === actor))
      .filter((a) => (needle ? a.message.toLowerCase().includes(needle) || a.actor.toLowerCase().includes(needle) : true));
  }, [state.activity, kind, actor, q]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const r of rows) {
      const key = dayLabel(r.at);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()];
  }, [rows]);

  const counts = useMemo(() => {
    const c = {} as Record<Kind, number>;
    for (const k of KINDS) c[k] = 0;
    for (const a of state.activity) c[a.kind] += 1;
    return c;
  }, [state.activity]);

  const filtersActive = kind !== "all" || actor !== "all" || q.trim() !== "";

  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle="Immutable audit trail of every automated decision and operator action across the warehouse."
        actions={
          filtersActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setKind("all");
                setActor("all");
                setQ("");
              }}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total events" value={state.activity.length} icon={ActivityIcon} tone="info" hint={`${actors.length} actors`} />
        <KpiCard label="Order events" value={counts.order} icon={PackageSearch} />
        <KpiCard label="Dispatch events" value={counts.dispatch} icon={Truck} tone="success" />
        <KpiCard label="Exception events" value={counts.exception} icon={AlertTriangle} tone="danger" />
      </div>

      <SectionCard
        className="mt-4"
        title={`Events (${rows.length})`}
        description="Newest first, grouped by day."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search message or actor…"
              className="h-9 w-full sm:w-56"
              aria-label="Search activity"
            />
            <Select value={kind} onValueChange={(v) => setKind(v as "all" | Kind)}>
              <SelectTrigger className="h-9 w-36" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All types</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="h-9 w-40" aria-label="Filter by actor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All actors</SelectItem>
                {actors.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No matching activity"
            description="Adjust the filters, or run warehouse actions to generate new audit events."
            icon={ActivityIcon}
          />
        ) : (
          <div className="space-y-6">
            {groups.map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{day}</p>
                  <span className="tabular text-[11px] text-muted-foreground/70">{items.length} events</span>
                </div>
                <ol className="relative border-l border-border pl-5">
                  {items.map((a) => {
                    const meta = KIND_META[a.kind];
                    return (
                      <li key={a.id} className="relative pb-4 last:pb-0">
                        <span className="absolute -left-[27px] grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                          <meta.icon className="size-3" />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          <span className="text-sm font-medium">{a.message}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {a.actor} · {fmtDateTime(a.at)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
