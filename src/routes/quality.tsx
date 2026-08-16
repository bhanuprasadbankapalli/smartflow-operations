import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime, money } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "Quality Control — SmartFlow WMS" },
      { name: "description", content: "Four-point inspection of packed orders with automatic exception creation on failure." },
      { property: "og:title", content: "Quality Control — SmartFlow WMS" },
      { property: "og:description", content: "Four-point inspection of packed orders with automatic exception creation on failure." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "worker"]}>
      <QualityPage />
    </RoleGate>
  ),
});

function QualityPage() {
  const { state, submitQualityCheck } = useWms();
  const pending = state.orders.filter((o) => o.status === "QUALITY_CHECK");
  const checks = state.qualityChecks;
  const items = ["Correct items and quantities", "Packaging intact", "Label and address readable", "No visible damage"];

  return (
    <>
      <PageHeader title="Quality Control" subtitle="Inspect packed orders before dispatch. A failed check raises an exception automatically." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Awaiting inspection" value={pending.length} />
        <KpiCard label="Passed" value={checks.filter((c) => c.result === "PASS").length} tone="success" />
        <KpiCard label="Failed" value={checks.filter((c) => c.result === "FAIL").length} tone="danger" />
        <KpiCard label="Checks logged" value={checks.length} tone="info" />
      </div>
      <SectionCard className="mt-4" title={`Inspection queue (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState title="Nothing to inspect" description="Packed orders arrive here for a four-point check." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((o) => (
              <div key={o.id} className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold">{o.id}</p>
                    <p className="text-xs text-muted-foreground">{state.customers.find((c) => c.id === o.customerId)?.name}</p>
                  </div>
                  <PriorityBadge priority={o.priority} />
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {items.map((i) => <li key={i}>• {i}</li>)}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => submitQualityCheck(o.id, Object.fromEntries(items.map((i) => [i, true])), true)}>
                    Pass inspection
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => submitQualityCheck(o.id, Object.fromEntries(items.map((i) => [i, false])), false, "Failed visual inspection")}>
                    Fail inspection
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
