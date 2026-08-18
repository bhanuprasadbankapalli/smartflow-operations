import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Gauge,
  PackageCheck,
  PackageSearch,
  Radar,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OrderStatusBadge, Pill, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, ProgressBar } from "@/components/wms/bits";
import { ChartSkeleton, MetricCard } from "@/components/wms/dashboard-parts";
import {
  HOUR,
  buildRecommendations,
  fmtDateTime,
  fmtTime,
  kpis,
  money,
  primaryBottleneck,
  productStatus,
  relative,
  stageMetrics,
} from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control Tower — SmartFlow WMS" },
      {
        name: "description",
        content:
          "SmartFlow control tower: live order pipeline, inventory health, bottleneck radar and smart fulfilment decisions in one premium operations dashboard.",
      },
      { property: "og:title", content: "Control Tower — SmartFlow WMS" },
      {
        property: "og:description",
        content: "Live order pipeline, inventory health, bottleneck radar and smart operational decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "var(--color-danger)",
  HIGH: "var(--color-warning)",
  MEDIUM: "var(--color-info)",
  NORMAL: "var(--color-muted-foreground)",
};

const CHART_TOOLTIP = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-panel)",
} as const;

const BUCKETS = 8;
const BUCKET_MS = 6 * HOUR;

function bucketCounts(times: number[], clock: number) {
  const out = Array.from({ length: BUCKETS }, () => 0);
  const start = clock - BUCKETS * BUCKET_MS;
  for (const t of times) {
    if (t < start || t > clock) continue;
    const idx = Math.min(BUCKETS - 1, Math.floor((t - start) / BUCKET_MS));
    out[idx] = (out[idx] ?? 0) + 1;
  }
  return out;
}

const pctChange = (series: number[]) => {
  const last = series[series.length - 1] ?? 0;
  const prev = series[series.length - 2] ?? 0;
  if (!prev) return last ? 100 : 0;
  return Math.round(((last - prev) / prev) * 100);
};

const shape = (total: number, weights: number[]) =>
  weights.map((w) => Math.max(0, Math.round(total * w)));

function Dashboard() {
  const { state, role, actor, runSmartAllocation, runPrioritization, runDemoScenario } = useWms();
  const [ready, setReady] = useState(false);
  const [flowView, setFlowView] = useState<"volume" | "throughput">("volume");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), 220);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);


  const k = kpis(state);
  const metrics = stageMetrics(state);
  const bottleneck = primaryBottleneck(state);
  const recs = useMemo(() => buildRecommendations(state).slice(0, 3), [state]);

  const created = bucketCounts(state.orders.map((o) => o.createdAt), state.clock);
  const done = bucketCounts(
    state.orders.filter((o) => o.completedAt).map((o) => o.completedAt!),
    state.clock,
  );
  const exceptionSeries = bucketCounts(state.exceptions.map((e) => e.detectedAt), state.clock);

  const flowData = created.map((c, i) => ({
    label: fmtTime(state.clock - (BUCKETS - 1 - i) * BUCKET_MS),
    created: c,
    completed: done[i] ?? 0,
    throughput: Math.round(((done[i] ?? 0) / Math.max(1, c)) * 100),
  }));

  const priorityData = (["CRITICAL", "HIGH", "MEDIUM", "NORMAL"] as const).map((p) => ({
    name: p,
    value: state.orders.filter((o) => o.priority === p).length,
  }));

  const invHealth = [
    { name: "Healthy", value: state.products.filter((p) => productStatus(state, p) === "IN_STOCK").length, fill: "var(--color-success)" },
    { name: "Reserved", value: state.products.filter((p) => productStatus(state, p) === "RESERVED").length, fill: "var(--color-info)" },
    { name: "Low", value: k.lowStock, fill: "var(--color-warning)" },
    { name: "Out", value: k.outOfStock, fill: "var(--color-danger)" },
    { name: "Damaged", value: state.products.filter((p) => p.damaged > 0).length, fill: "var(--color-accent)" },
  ];

  const openExceptions = state.exceptions.filter((e) => e.status !== "RESOLVED").slice(0, 3);
  const inFlight = k.picking + k.packing + k.qc + k.readyForDispatch;
  const displayNow = now ?? state.clock;

  const hour = new Date(displayNow).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const liveStamp = new Date(displayNow).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });


  const flowStages = [
    { label: "Pending", value: k.pending, icon: Clock, to: "/orders", tone: "info" as const },
    { label: "Picking", value: k.picking, icon: Boxes, to: "/picking", tone: "info" as const },
    { label: "Packing", value: k.packing, icon: PackageCheck, to: "/packing", tone: "warning" as const },
    { label: "Quality", value: k.qc, icon: ShieldCheck, to: "/quality", tone: "warning" as const },
    { label: "Dispatch", value: k.readyForDispatch, icon: Truck, to: "/dispatch", tone: "primary" as const },
    { label: "Completed", value: k.completed, icon: CheckCircle2, to: "/analytics", tone: "success" as const },
  ];

  const quickActions = [
    { label: "Order book", desc: `${k.total} orders in scope`, icon: PackageSearch, to: "/orders" },
    { label: "Picking console", desc: `${state.pickingTasks.length} tasks routed`, icon: Boxes, to: "/picking" },
    { label: "Inventory ledger", desc: money(k.inventoryValue), icon: Warehouse, to: "/inventory" },
    { label: "Reorder engine", desc: `${k.lowStock} items below point`, icon: ClipboardCheck, to: "/reorder" },
    { label: "Exceptions", desc: `${k.openExceptions} open`, icon: AlertTriangle, to: "/exceptions" },
    { label: "Activity log", desc: `${state.activity.length} events`, icon: Activity, to: "/activity" },
  ];

  const health = [{ name: "rate", value: k.fulfillmentRate, fill: "var(--color-success)" }];

  return (
    <TooltipProvider delayDuration={150}>
      {/* ---------------------------- command deck ---------------------------- */}
      <section className="deck fade-rise px-5 py-6 sm:px-7 sm:py-8">
        <span className="deck-grid" aria-hidden />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="success" dot>
                Live shift
              </Pill>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">
                <span className="tabular">{liveStamp}</span>
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-sidebar-accent-foreground sm:text-[2rem]">
              {greeting}, Bhanu Prasad
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-sidebar-foreground/70">
              {inFlight} orders are moving through the line right now.{" "}
              {bottleneck
                ? `${bottleneck.label} is the current constraint — ${bottleneck.waiting} orders queued.`
                : "No stage constraints detected across the fulfilment line."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {role === "manager" ? (
                <>
                  <Button size="sm" onClick={() => runSmartAllocation()} className="shadow-lg">
                    <Sparkles className="size-4" /> Run smart allocation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runPrioritization}
                    className="border-sidebar-border bg-sidebar-accent/40 text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  >
                    <Gauge className="size-4" /> Re-score priorities
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={runDemoScenario}
                    className="text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  >
                    <Zap className="size-4" /> Arm demo scenario
                  </Button>
                </>
              ) : (
                <Pill tone="info">Read-only view for your role</Pill>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-100 lg:grid-cols-2">
            {[
              { label: "In flight", value: inFlight, tone: "text-sidebar-primary" },
              { label: "Fulfilment", value: `${k.fulfillmentRate}%`, tone: "text-success" },
              { label: "Delayed", value: k.delayed, tone: "text-warning" },
              { label: "Exceptions", value: k.openExceptions, tone: "text-danger" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/35 px-3.5 py-3 backdrop-blur transition-colors hover:bg-sidebar-accent/60"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/55">{s.label}</p>
                <p className={cn("tabular mt-1 text-xl font-bold leading-none", s.tone)}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ pipeline flow ------------------------------ */}
      <div className="glass mt-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-0">
        {flowStages.map((s, i) => (
          <div key={s.label} className="flex min-w-0 flex-1 items-center">
            <Link
              to={s.to}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/70"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                  {
                    info: "bg-info-soft text-info",
                    warning: "bg-warning-soft text-warning-foreground",
                    primary: "bg-primary/12 text-primary",
                    success: "bg-success-soft text-success",
                  }[s.tone],
                )}
              >
                <s.icon className="size-4.5" />
              </span>
              <div className="min-w-0">
                <p className="tabular text-lg font-bold leading-none">{s.value}</p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
              </div>
            </Link>
            {i < flowStages.length - 1 && (
              <span className="hidden h-8 w-px shrink-0 bg-border sm:block" aria-hidden />
            )}
          </div>
        ))}
      </div>

      {/* -------------------------------- metrics -------------------------------- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          ready={ready}
          label="Orders received"
          value={k.total}
          delta={pctChange(created)}
          hint="Orders created in the current operating window, bucketed per 6-hour shift block."
          icon={PackageSearch}
          tone="primary"
          spark={created}
        />
        <MetricCard
          ready={ready}
          label="Orders completed"
          value={k.completed}
          delta={pctChange(done)}
          hint={`Fulfilment rate ${k.fulfillmentRate}% · avg ${k.avgFulfillmentHours} h per order.`}
          icon={CheckCircle2}
          tone="success"
          spark={done.some((v) => v) ? done : shape(k.completed, [0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 0.8, 1])}
        />
        <MetricCard
          ready={ready}
          label="Delayed orders"
          value={k.delayed}
          delta={pctChange(shape(k.delayed, [0.4, 0.5, 0.55, 0.7, 0.75, 0.85, 0.95, 1]))}
          invert
          hint="Open orders whose deadline has passed or is inside the current stage target."
          icon={Timer}
          tone="warning"
          spark={shape(k.delayed, [0.4, 0.5, 0.55, 0.7, 0.75, 0.85, 0.95, 1])}
        />
        <MetricCard
          ready={ready}
          label="Open exceptions"
          value={k.openExceptions}
          delta={pctChange(exceptionSeries)}
          invert
          hint="Stock shortages, damaged picks and failed quality checks awaiting a decision."
          icon={ShieldCheck}
          tone={k.openExceptions ? "danger" : "success"}
          spark={exceptionSeries.some((v) => v) ? exceptionSeries : shape(k.openExceptions, [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1])}
        />
      </div>

      {/* ------------------------------- analytics ------------------------------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="glass flex flex-col p-4">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Order flow vs. completion</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Intake and fulfilment across the last {BUCKETS} shift blocks
              </p>
            </div>
            <Tabs value={flowView} onValueChange={(v) => setFlowView(v as typeof flowView)}>
              <TabsList className="h-8">
                <TabsTrigger value="volume" className="text-xs">
                  Volume
                </TabsTrigger>
                <TabsTrigger value="throughput" className="text-xs">
                  Throughput
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </header>

          <div className="mt-4 h-70">
            {!ready ? (
              <ChartSkeleton height={280} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {flowView === "volume" ? (
                  <AreaChart data={flowData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" allowDecimals={false} tickLine={false} axisLine={false} />
                    <RTooltip contentStyle={CHART_TOOLTIP} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      name="Received"
                      dataKey="created"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      fill="url(#gCreated)"
                    />
                    <Area
                      type="monotone"
                      name="Completed"
                      dataKey="completed"
                      stroke="var(--color-success)"
                      strokeWidth={2.5}
                      fill="url(#gDone)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={flowData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" unit="%" tickLine={false} axisLine={false} />
                    <RTooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [`${v}%`, "Throughput"]} />
                    <Bar dataKey="throughput" radius={[6, 6, 0, 0]} fill="var(--color-chart-1)" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            {[
              { label: "Fulfilment rate", value: `${k.fulfillmentRate}%` },
              { label: "Avg cycle time", value: `${k.avgFulfillmentHours} h` },
              { label: "Inventory value", value: money(k.inventoryValue) },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className="tabular mt-0.5 text-base font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="glass p-4">
            <h2 className="text-sm font-semibold tracking-tight">Priority mix</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Rule-based scoring across the open book</p>
            <div className="relative mt-2 h-48">
              {!ready ? (
                <ChartSkeleton height={192} />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={80}
                        paddingAngle={4}
                        stroke="var(--color-card)"
                        strokeWidth={2}
                      >
                        {priorityData.map((d) => (
                          <Cell key={d.name} fill={PRIORITY_COLORS[d.name]} />
                        ))}
                      </Pie>
                      <RTooltip contentStyle={CHART_TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="tabular text-2xl font-bold leading-none">{k.total}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">orders</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {priorityData.map((d) => (
                <PriorityBadge key={d.name} priority={d.name} score={d.value} />
              ))}
            </div>
          </section>

          <section className="glass p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
              <div className="relative size-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={health} innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={999} background={{ fill: "var(--color-muted)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <p className="tabular text-lg font-bold">{k.fulfillmentRate}%</p>
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">Inventory posture</h2>
                <div className="mt-2 flex flex-col gap-1.5">
                  {invHealth.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: r.fill }} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.name}</span>
                      <span className="tabular font-semibold">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ---------------------------- smart insights ---------------------------- */}
      <section className="insight-deck mt-4 p-4 sm:p-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Radar className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight">Smart Operations Assistant</h2>
              <p className="text-xs text-muted-foreground">
                Signals derived from live stock, deadlines and stage dwell-times
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/smart-decisions">
              Decisions <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </header>

        {bottleneck && (
          <div className="rail mt-4 rounded-xl bg-warning-soft/50 py-3 pl-4 pr-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{bottleneck.label} bottleneck · {bottleneck.slowerPct}% slower than the line</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {bottleneck.avgMinutes} min average per order · {bottleneck.waiting} queued · add{" "}
                  {bottleneck.extraWorkers} worker{bottleneck.extraWorkers > 1 ? "s" : ""}
                </p>
              </div>
              <AlertTriangle className="size-5 shrink-0 text-warning-foreground" />
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {recs.length === 0 ? (
            <div className="lg:col-span-3">
              <EmptyState title="No signals right now" description="The assistant found no risks in the current window." icon={CheckCircle2} />
            </div>
          ) : (
            recs.map((rec) => (
              <article key={rec.id} className="lift rounded-xl border border-border bg-card/70 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold leading-snug tracking-tight">{rec.title}</p>
                  <SeverityBadge severity={rec.severity} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{rec.reason}</p>
                <p className="mt-2 flex items-start gap-1.5 text-sm font-medium">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {rec.action}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* ------------------------ pipeline + watchlist ------------------------ */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="glass p-4">
          <h2 className="text-sm font-semibold tracking-tight">Stage load & dwell-time</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Average minutes per stage vs. operational target</p>
          <div className="mt-4 flex flex-col gap-3.5">
            {metrics.map((m) => (
              <div key={m.stage}>
                <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="truncate font-semibold">{m.label}</span>
                  <span className="tabular shrink-0 text-muted-foreground">
                    {m.waiting} queued · {m.avgMinutes}/{m.target} min
                    {m.bottleneck && <span className="ml-2 font-bold text-danger">BOTTLENECK</span>}
                  </span>
                </div>
                <ProgressBar
                  value={m.loadPct}
                  tone={m.bottleneck ? "danger" : m.avgMinutes > m.target ? "warning" : "success"}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="glass p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Urgent watchlist</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Highest scoring orders still in the pipeline</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/orders">All orders</Link>
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {state.orders
              .filter((o) => !["COMPLETED", "DISPATCHED", "CANCELLED"].includes(o.status))
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 5)
              .map((o) => (
                <Link
                  key={o.id}
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.id}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {state.customers.find((c) => c.id === o.customerId)?.name} · due {relative(o.deadline, state.clock)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PriorityBadge priority={o.priority} score={o.priorityScore} />
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              ))}
          </div>
        </section>
      </div>

      {/* ------------------------ activity + exceptions ------------------------ */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="glass p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Live operations feed</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Every automated and manual warehouse action</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/activity">Full log</Link>
            </Button>
          </div>
          {state.activity.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No activity yet" description="Actions will appear here as the shift progresses." />
            </div>
          ) : (
            <ol className="mt-3 flex flex-col">
              {state.activity.slice(0, 7).map((a, i, arr) => (
                <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-primary bg-card" />
                    {i < arr.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-3.5">
                    <p className="text-sm leading-snug">{a.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.actor} · {fmtDateTime(a.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="glass p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Exception radar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Detect → analyse → decide → resolve</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/exceptions">Manage</Link>
            </Button>
          </div>
          {openExceptions.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No open exceptions" description="Every fulfilment line is currently clean." icon={CheckCircle2} />
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {openExceptions.map((e) => (
                <div key={e.id} className="rail rounded-xl border border-border py-2.5 pl-4 pr-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold uppercase tracking-wide">
                      {e.type.replaceAll("_", " ")}
                    </span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">Detected {fmtDateTime(e.detectedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ----------------------------- quick actions ----------------------------- */}
      <section className="mt-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Jump back in</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((a) => (
            <Tooltip key={a.label}>
              <TooltipTrigger asChild>
                <Link
                  to={a.to}
                  className="glass lift group flex items-center gap-3 p-3.5 sm:flex-col sm:items-start sm:gap-2"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <a.icon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.desc}</p>
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Open {a.label.toLowerCase()}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </section>
    </TooltipProvider>
  );
}
