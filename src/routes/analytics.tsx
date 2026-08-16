import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime, money } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import { kpis, stageMetrics } from "@/lib/wms/engine";\nimport { ProgressBar } from "@/components/wms/bits";\n
export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Performance Analytics — SmartFlow WMS" },
      { name: "description", content: "Throughput, on-time delivery and stage dwell-time analytics for warehouse operations." },
      { property: "og:title", content: "Performance Analytics — SmartFlow WMS" },
      { property: "og:description", content: "Throughput, on-time delivery and stage dwell-time analytics for warehouse operations." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager"]}>
      <AnalyticsPage />
    </RoleGate>
  ),
});

function AnalyticsPage() {
  const { state } = useWms();
  const k = kpis(state);
  const stages = stageMetrics(state);

  return (
    <>
      <PageHeader title="Performance Analytics" subtitle="Throughput, stage timings and fulfilment quality across the whole warehouse." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Orders delivered" value={k.delivered} tone="success" />
        <KpiCard label="On-time rate" value={`${k.onTimeRate}%`} tone={k.onTimeRate >= 90 ? "success" : "warning"} />
        <KpiCard label="Avg fulfilment" value={`${k.avgFulfilmentHours} h`} tone="info" />
        <KpiCard label="Fulfilment value" value={money(k.openOrderValue)} />
      </div>
      <SectionCard className="mt-4" title="Stage throughput" description="Orders waiting at each stage against its target dwell time.">
        <div className="space-y-3">
          {stages.map((s) => (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="tabular text-muted-foreground">{s.count} orders · avg {s.avgHours} h (target {s.target} h)</span>
              </div>
              <ProgressBar value={Math.min(100, (s.avgHours / Math.max(1, s.target)) * 100)} tone={s.avgHours > s.target ? "danger" : "success"} />
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
