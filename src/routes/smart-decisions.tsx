import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { kpis } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import { buildRecommendations, primaryBottleneck } from "@/lib/wms/engine";

export const Route = createFileRoute("/smart-decisions")({
  head: () => ({
    meta: [
      { title: "Smart Decisions — SmartFlow WMS" },
      { name: "description", content: "Explainable operational recommendations covering priorities, allocation, bottlenecks and restocking." },
      { property: "og:title", content: "Smart Decisions — SmartFlow WMS" },
      { property: "og:description", content: "Explainable operational recommendations covering priorities, allocation, bottlenecks and restocking." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "dispatcher"]}>
      <SmartDecisionsPage />
    </RoleGate>
  ),
});

function SmartDecisionsPage() {
  const { state, runPrioritization, runSmartAllocation } = useWms();
  const recs = buildRecommendations(state);
  const bottleneck = primaryBottleneck(state);

  return (
    <>
      <PageHeader
        title="Smart Decisions"
        subtitle="Every recommendation shows the data it used, so operators can see why the system suggests each action."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runPrioritization}>Re-score priorities</Button>
            <Button size="sm" onClick={() => runSmartAllocation()}>Run smart allocation</Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Active recommendations" value={recs.length} tone="info" />
        <KpiCard label="Critical actions" value={recs.filter((r) => r.severity === "CRITICAL").length} tone="danger" />
        <KpiCard label="Bottleneck stage" value={bottleneck ? bottleneck.label : "None"} tone="warning" />
        <KpiCard label="Open exceptions" value={state.exceptions.filter((e) => e.status !== "RESOLVED").length} />
      </div>
      <SectionCard className="mt-4" title="Recommended actions">
        {recs.length === 0 ? (
          <EmptyState title="Operations look healthy" description="No corrective action is recommended right now." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recs.map((r) => (
              <div key={r.id} className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <SeverityBadge severity={r.severity} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                <p className="mt-2 text-xs"><span className="font-medium">Why:</span> {r.reason}</p>
                <p className="mt-1 text-xs"><span className="font-medium">Action:</span> {r.action}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
