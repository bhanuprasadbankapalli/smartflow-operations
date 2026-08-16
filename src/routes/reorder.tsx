import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime, money } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/reorder")({
  head: () => ({
    meta: [
      { title: "Reorder Requests — SmartFlow WMS" },
      { name: "description", content: "Replenishment approval queue driven by reorder-point breaches and demand forecasts." },
      { property: "og:title", content: "Reorder Requests — SmartFlow WMS" },
      { property: "og:description", content: "Replenishment approval queue driven by reorder-point breaches and demand forecasts." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager"]}>
      <ReorderPage />
    </RoleGate>
  ),
});

function ReorderPage() {
  const { state, setReorderStatus } = useWms();

  return (
    <>
      <PageHeader title="Reorder Requests" subtitle="Replenishment suggestions raised from reorder-point breaches, awaiting manager approval." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pending" value={state.reorders.filter((r) => r.status === "PENDING").length} tone="warning" />
        <KpiCard label="Approved" value={state.reorders.filter((r) => r.status === "APPROVED").length} tone="success" />
        <KpiCard label="Ordered" value={state.reorders.filter((r) => r.status === "ORDERED").length} tone="info" />
        <KpiCard label="Rejected" value={state.reorders.filter((r) => r.status === "REJECTED").length} />
      </div>
      <SectionCard className="mt-4" title={`Requests (${state.reorders.length})`}>
        {state.reorders.length === 0 ? (
          <EmptyState title="No reorder requests" description="Create one from the inventory page when stock runs low." />
        ) : (
          <div className="space-y-2">
            {state.reorders.map((r) => {
              const p = state.products.find((x) => x.id === r.productId);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{p?.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.quantity} units · {money((p?.unitPrice ?? 0) * r.quantity)} · {r.status} · raised {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                  {r.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setReorderStatus(r.id, "APPROVED")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setReorderStatus(r.id, "REJECTED")}>Reject</Button>
                    </div>
                  ) : r.status === "APPROVED" ? (
                    <Button size="sm" variant="outline" onClick={() => setReorderStatus(r.id, "ORDERED")}>Mark ordered</Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
