import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime, money } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/exceptions")({
  head: () => ({
    meta: [
      { title: "Exception Handling — SmartFlow WMS" },
      { name: "description", content: "Central log of warehouse disruptions with impact analysis and recommended recovery actions." },
      { property: "og:title", content: "Exception Handling — SmartFlow WMS" },
      { property: "og:description", content: "Central log of warehouse disruptions with impact analysis and recommended recovery actions." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "dispatcher", "worker"]}>
      <ExceptionsPage />
    </RoleGate>
  ),
});

function ExceptionsPage() {
  const { state, resolveException } = useWms();
  const open = state.exceptions.filter((e) => e.status !== "RESOLVED");

  return (
    <>
      <PageHeader title="Exception Handling" subtitle="Every disruption is logged with its automated impact analysis and recommended recovery action." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Open exceptions" value={open.length} tone="danger" />
        <KpiCard label="Critical" value={open.filter((e) => e.severity === "CRITICAL").length} tone="danger" />
        <KpiCard label="Resolved" value={state.exceptions.filter((e) => e.status === "RESOLVED").length} tone="success" />
        <KpiCard label="Total logged" value={state.exceptions.length} tone="info" />
      </div>
      <SectionCard className="mt-4" title={`Exception log (${state.exceptions.length})`}>
        {state.exceptions.length === 0 ? (
          <EmptyState title="No exceptions" description="Stock shortages, damage and failed checks show up here." />
        ) : (
          <div className="space-y-2">
            {state.exceptions.map((e) => (
              <div key={e.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={e.severity} />
                    {e.status !== "RESOLVED" && (
                      <Button size="sm" variant="outline" onClick={() => resolveException(e.id)}>Resolve</Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Recommended action:</span> {e.recommendation} · logged {fmtDateTime(e.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
