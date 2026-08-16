import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Gauge,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Warehouse,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { OrderStatusBadge, Pill, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { DataRow, EmptyState, KpiCard, PageHeader, ProgressBar, SectionCard } from "@/components/wms/bits";
import {
  buildRecommendations,
  fmtDateTime,
  kpis,
  money,
  primaryBottleneck,
  productStatus,
  relative,
  stageMetrics,
} from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — SmartFlow WMS" },
      {
        name: "description",
        content:
          "Live warehouse control tower: order pipeline, inventory health, bottleneck detection and smart fulfilment recommendations.",
      },
      { property: "og:title", content: "Operations Dashboard — SmartFlow WMS" },
      {
        property: "og:description",
        content: "Live order pipeline, inventory health, bottlenecks and smart operational decisions.",
      },
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

function Dashboard() {
  const { state, role, runSmartAllocation, runPrioritization, runDemoScenario } = useWms();
  const k = kpis(state);
  const metrics = stageMetrics(state);
  const bottleneck = primaryBottleneck(state);
  const recs = buildRecommendations(state).slice(0, 4);

  const statusData = [
    { name: "Pending", value: k.pending },
    { name: "Picking", value: k.picking },
    { name: "Packing", value: k.packing },
    { name: "QC", value: k.qc },
    { name: "Dispatch", value: k.readyForDispatch },
    { name: "Shipped", value: k.dispatched },
    { name: "Done", value: k.completed },
    { name: "Backorder", value: k.backorder },
    { name: "Exception", value: k.exceptions },
  ];

  const priorityData = (["CRITICAL", "HIGH", "MEDIUM", "NORMAL"] as const).map((p) => ({
    name: p,
    value: state.orders.filter((o) => o.priority === p).length,
  }));

  const invHealth = [
    { name: "Healthy", value: state.products.filter((p) => productStatus(state, p) === "IN_STOCK").length },
    { name: "Reserved", value: state.products.filter((p) => productStatus(state, p) === "RESERVED").length },
    { name: "Low", value: k.lowStock },
    { name: "Out", value: k.outOfStock },
    { name: "Damaged", value: state.products.filter((p) => p.damaged > 0).length },
  ];

  const openExceptions = state.exceptions.filter((e) => e.status !== "RESOLVED").slice(0, 4);
  const pickingTasks = state.pickingTasks;
  const pickDone = pickingTasks.filter((t) => t.status === "COMPLETED").length;
  const packDone = state.packingTasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <>
      <PageHeader
        title="Warehouse Operations Dashboard"
        subtitle="Don't just monitor the warehouse — help the warehouse make better decisions."
        actions={
          role === "manager" ? (
            <>
              <Button variant="outline" size="sm" onClick={runPrioritization}>
                <Gauge className="size-4" /> Re-run prioritization
              </Button>
              <Button size="sm" onClick={() => runSmartAllocation()}>
                <Sparkles className="size-4" /> Run smart allocation
              </Button>
            </>
          ) : (
            <Pill tone="info">Read-only view for your role</Pill>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total orders" value={k.total} icon={PackageSearch} hint={`${money(k.inventoryValue)} inventory value`} />
        <KpiCard label="Pending" value={k.pending} icon={Clock} tone="info" hint="Awaiting allocation" />
        <KpiCard label="In picking" value={k.picking} icon={Boxes} tone="info" hint={`${pickDone} tasks completed`} />
        <KpiCard label="In packing" value={k.packing} icon={PackageCheck} tone="warning" hint={`${packDone} packs completed`} />
        <KpiCard label="Ready for dispatch" value={k.readyForDispatch} icon={Truck} tone="warning" />
        <KpiCard label="Completed" value={k.completed} icon={CheckCircle2} tone="success" hint={`${k.fulfillmentRate}% fulfilment rate`} />
        <KpiCard label="Low stock" value={k.lowStock} icon={Warehouse} tone="warning" />
        <KpiCard label="Out of stock" value={k.outOfStock} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Delayed orders" value={k.delayed} icon={Timer} tone="danger" />
        <KpiCard label="Open exceptions" value={k.openExceptions} icon={ShieldCheck} tone={k.openExceptions ? "danger" : "success"} />
      </div>

      {bottleneck && (
        <div className="panel mt-4 border-l-4 border-l-warning p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning-foreground">
                <AlertTriangle className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">{bottleneck.label} bottleneck detected</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {bottleneck.label} averages {bottleneck.avgMinutes} min per order ({bottleneck.slowerPct}% slower than
                  the rest of the line) with {bottleneck.waiting} orders queued.
                </p>
                <p className="mt-1 text-sm font-medium">
                  Recommendation: assign {bottleneck.extraWorkers} additional worker
                  {bottleneck.extraWorkers > 1 ? "s" : ""} to {bottleneck.label.toLowerCase()}.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/smart-decisions">Open smart decisions</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Order status overview"
          description="Orders currently sitting in each fulfilment state"
          className="xl:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Order priority distribution" description="Rule-based scoring across the open book">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {priorityData.map((d) => (
                    <Cell key={d.name} fill={PRIORITY_COLORS[d.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {priorityData.map((d) => (
              <PriorityBadge key={d.name} priority={d.name} score={d.value} />
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Fulfilment pipeline & bottleneck detection"
          description="Average minutes per stage vs. operational target"
          className="xl:col-span-2"
        >
          <div className="flex flex-col gap-3">
            {metrics.map((m) => (
              <div key={m.stage}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold">{m.label}</span>
                  <span className="tabular text-muted-foreground">
                    {m.waiting} waiting · {m.avgMinutes} min avg (target {m.target})
                    {m.bottleneck && <span className="ml-2 font-bold text-danger">BOTTLENECK</span>}
                  </span>
                </div>
                <ProgressBar value={m.loadPct} tone={m.bottleneck ? "danger" : m.avgMinutes > m.target ? "warning" : "success"} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Inventory health" description="Stock posture across the catalogue">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invHealth} layout="vertical" margin={{ left: 8, right: 12 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={64} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {invHealth.map((d, i) => (
                    <Cell
                      key={d.name}
                      fill={[
                        "var(--color-success)",
                        "var(--color-info)",
                        "var(--color-warning)",
                        "var(--color-danger)",
                        "var(--color-accent)",
                      ][i]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataRow label="Fulfilment rate" value={`${k.fulfillmentRate}%`} />
          <DataRow label="Avg fulfilment time" value={`${k.avgFulfillmentHours} h`} />
          <DataRow label="Picking tasks completed" value={`${pickDone}/${pickingTasks.length}`} />
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Smart Operations Assistant"
          description="Automatically generated operational decisions"
          className="xl:col-span-2"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/smart-decisions">View all</Link>
            </Button>
          }
        >
          <div className="flex flex-col gap-2.5">
            {recs.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold tracking-tight">{rec.title}</p>
                  <SeverityBadge severity={rec.severity} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{rec.reason}</p>
                <p className="mt-1.5 text-sm font-medium">→ {rec.action}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent exceptions"
          description="Exception → analysis → decision → resolution"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/exceptions">Manage</Link>
            </Button>
          }
        >
          {openExceptions.length === 0 ? (
            <EmptyState title="No open exceptions" description="Every fulfilment line is currently clean." icon={CheckCircle2} />
          ) : (
            <div className="flex flex-col gap-2.5">
              {openExceptions.map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide">{e.type.replaceAll("_", " ")}</span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">Detected {fmtDateTime(e.detectedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title="Hackathon demo scenario"
        description="Competing demand for a single scarce product, resolved by priority"
        actions={
          <Button size="sm" onClick={runDemoScenario}>
            <Sparkles className="size-4" /> Run Smart Decision Demo
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scarce product</p>
            <p className="mt-1 text-sm font-bold">Industrial Safety Helmet</p>
            <p className="text-xs text-muted-foreground">7 available units</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ORD-5001</p>
            <p className="mt-1 text-sm font-bold">Requires 10 units</p>
            <PriorityBadge priority="CRITICAL" />
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ORD-5002</p>
            <p className="mt-1 text-sm font-bold">Requires 5 units</p>
            <PriorityBadge priority="NORMAL" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Arm the scenario, then run smart allocation on the Smart Decisions page to see 7 units go to the critical
          order, a 3-unit backorder created, and ORD-5002 held for replenishment.
        </p>
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Latest activity" description="Audit trail of warehouse actions">
          <ol className="flex flex-col gap-3">
            {state.activity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm">{a.message}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.actor} · {fmtDateTime(a.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Urgent order watchlist" description="Highest scoring orders still in the pipeline">
          <div className="flex flex-col gap-2">
            {state.orders
              .filter((o) => !["COMPLETED", "DISPATCHED", "CANCELLED"].includes(o.status))
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 6)
              .map((o) => (
                <Link
                  key={o.id}
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/60"
                >
                  <div>
                    <p className="text-sm font-semibold">{o.id}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Deadline {relative(o.deadline, state.clock)} · {state.customers.find((c) => c.id === o.customerId)?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={o.priority} score={o.priorityScore} />
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
